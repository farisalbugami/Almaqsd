import Anthropic from "@anthropic-ai/sdk";
import * as z from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { audienceById, campaign, env, type Audience, type ChannelId } from "../config.js";
import { logger } from "../logger.js";
import { BRAND_SYSTEM, buildUserPrompt } from "./brand.js";
import type { Post } from "../types.js";

const PostContentSchema = z.object({
  hook: z.string(),
  body: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()),
  mediaBrief: z.string(),
});

export type GeneratedContent = z.infer<typeof PostContentSchema>;

const client = env.anthropicApiKey ? new Anthropic({ apiKey: env.anthropicApiKey }) : null;

/** كلمات ممنوعة — رفضها أرخص من نشرها */
const BANNED = ["رائد", "الأفضل", "نخبة", "مضمون العائد", "عائد مضمون", "أرباح مضمونة"];

export interface GenerationOutcome {
  ok: boolean;
  content?: GeneratedContent;
  reason?: string;
}

function validate(content: GeneratedContent, channel: ChannelId): string | null {
  const max = campaign.channels[channel].maxChars;
  if (!content.body?.trim()) return "النص فارغ";
  if (content.body.length > max) return `النص تجاوز الحد الأقصى (${content.body.length}/${max})`;
  const hit = BANNED.find((w) => content.body.includes(w));
  if (hit) return `يحتوي كلمة ممنوعة: ${hit}`;
  if (channel === "linkedin" && /\p{Extended_Pictographic}/u.test(content.body))
    return "رموز تعبيرية غير مسموحة في لينكدإن";
  return null;
}

/** محتوى بديل يُستخدم عند تعذّر الاتصال بالنموذج — يبقي المسار حيًا للمراجعة البشرية */
function fallbackContent(post: Post, audience: Audience): GeneratedContent {
  return {
    hook: `${post.topic}`,
    body: `${post.topic}\n\n[مسودة تحتاج كتابة يدوية — تعذّر توليد المحتوى آليًا]\n\nالشريحة: ${audience.name}\nالرسالة المطلوبة: ${audience.message}`,
    cta: campaign.offers.primary.name,
    hashtags: ["إدارة_الأملاك", "العقار_السعودي", "الرياض"],
    mediaBrief: "يحتاج تحديدًا يدويًا.",
  };
}

export async function generateForPost(post: Post): Promise<GenerationOutcome> {
  const audience = audienceById(post.audience_id);
  if (!audience) return { ok: false, reason: `شريحة غير معروفة: ${post.audience_id}` };

  if (!client) {
    logger.warn({ postId: post.id }, "ANTHROPIC_API_KEY غير مضبوط — استخدام مسودة بديلة");
    return { ok: true, content: fallbackContent(post, audience), reason: "no-api-key" };
  }

  const userPrompt = buildUserPrompt({
    channel: post.channel,
    topic: post.topic,
    theme: post.theme,
    week: post.week,
    contentType: post.content_type,
    audience,
    maxChars: campaign.channels[post.channel].maxChars,
  });

  const attempt = async (extraInstruction?: string): Promise<GenerationOutcome> => {
    const response = await client.messages.parse({
      model: env.contentModel,
      max_tokens: 8000,
      system: [{ type: "text", text: BRAND_SYSTEM, cache_control: { type: "ephemeral" } }],
      thinking: { type: "adaptive" },
      messages: [
        { role: "user", content: extraInstruction ? `${userPrompt}\n\n## تصحيح مطلوب\n${extraInstruction}` : userPrompt },
      ],
      output_config: { format: zodOutputFormat(PostContentSchema) },
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, reason: `رفض النموذج التوليد: ${response.stop_details?.category ?? "غير محدد"}` };
    }
    const parsed = response.parsed_output;
    if (!parsed) return { ok: false, reason: "تعذّر تحليل مخرجات النموذج" };

    const problem = validate(parsed, post.channel);
    if (problem) return { ok: false, reason: problem, content: parsed };
    return { ok: true, content: parsed };
  };

  try {
    const first = await attempt();
    if (first.ok) return first;

    logger.warn({ postId: post.id, reason: first.reason }, "المحاولة الأولى فشلت التحقق — إعادة المحاولة");
    const second = await attempt(
      `المحاولة السابقة رُفضت للسبب التالي: ${first.reason}. أعد الكتابة مع معالجة هذا السبب تحديدًا.`
    );
    if (second.ok) return second;
    return { ok: false, reason: `فشل التحقق مرتين: ${second.reason}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ postId: post.id, err: message }, "خطأ في توليد المحتوى");
    return { ok: false, reason: message };
  }
}

/** رمز موافقة قصير يسهل كتابته في رد واتساب */
export function makeApprovalCode(postId: number): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const idx = letters[postId % letters.length] ?? "A";
  return `${idx}${String(postId).padStart(3, "0")}`;
}
