import { campaign, type ChannelId } from "../config.js";
import { logger } from "../logger.js";
import { notifyApprovers } from "../messaging/whatsapp.js";
import { fmtRiyadh } from "../time.js";
import type { ActionResult, Post } from "../types.js";
import type { Publisher } from "./types.js";

const LABEL: Record<string, string> = { tiktok: "تيك توك", snapchat: "سناب شات" };

/**
 * تيك توك وسناب شات لا يتيحان نشرًا برمجيًا للمحتوى العضوي كما تفعل ميتا ولينكدإن:
 * تيك توك يشترط رفع ملف فيديو عبر Content Posting API بعد اعتماد التطبيق،
 * وسناب لا يوفّر واجهة نشر عضوي أصلًا.
 * لذلك يسلّم النظام المحتوى جاهزًا للموظف عبر واتساب في موعد النشر بدل ادعاء نشر لا يحدث.
 */
function manualPublisher(id: ChannelId): Publisher {
  return {
    id,
    mode: "manual",
    isConfigured: () => true,
    async publish(post: Post): Promise<ActionResult> {
      const message = [
        `📤 *حان وقت النشر — ${LABEL[id] ?? id}*`,
        `الموعد: ${fmtRiyadh(post.scheduled_at)}`,
        `الموضوع: ${post.topic}`,
        "",
        "— النص الجاهز —",
        post.body ?? "",
        "",
        `دعوة الفعل: ${post.cta ?? ""}`,
        post.hashtags ? `الوسوم: ${post.hashtags}` : "",
        "",
        `🎬 الوسيط المطلوب: ${post.media_brief ?? "—"}`,
        "",
        `${campaign.company.shortName} — انشره ثم أرسل: تم ${post.approval_code ?? ""}`,
      ]
        .filter(Boolean)
        .join("\n");

      await notifyApprovers(message);
      logger.info({ postId: post.id, channel: id }, "تم تسليم المحتوى للنشر اليدوي");
      return { ok: true, externalId: `manual-${post.id}` };
    },
  };
}

export const tiktokPublisher = manualPublisher("tiktok");
export const snapchatPublisher = manualPublisher("snapchat");
