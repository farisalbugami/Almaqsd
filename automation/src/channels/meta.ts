import { env } from "../config.js";
import { logger } from "../logger.js";
import type { ActionResult, Post } from "../types.js";
import { GRAPH_VERSION, type Publisher } from "./types.js";

function fullText(post: Post): string {
  const tags = post.hashtags ? `\n\n${post.hashtags}` : "";
  return `${post.body ?? ""}\n\n${post.cta ?? ""}${tags}`.trim();
}

/**
 * إنستقرام — يتطلب رابط وسائط عام (صورة أو فيديو).
 * المحتوى النصي وحده لا يُنشر على إنستقرام برمجيًا؛ لذلك يُرفع الوسيط أولًا
 * إلى مسار عام ثم يُمرَّر رابطه في حقل media_url داخل media_brief بالصيغة: media_url=https://...
 */
export const instagramPublisher: Publisher = {
  id: "instagram",
  mode: "api",

  isConfigured(): boolean {
    return Boolean(env.meta.accessToken && env.meta.igUserId);
  },

  async publish(post: Post): Promise<ActionResult> {
    if (env.dryRun || !this.isConfigured()) {
      logger.info({ postId: post.id }, "[محاكاة] نشر إنستقرام");
      return { ok: true, simulated: true, externalId: `sim-ig-${post.id}` };
    }

    const mediaUrl = /media_url=(\S+)/.exec(post.media_brief ?? "")?.[1];
    if (!mediaUrl) {
      return { ok: false, error: "إنستقرام يتطلب رابط وسائط — أضف media_url=... في وصف الوسيط" };
    }

    try {
      const createRes = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${env.meta.igUserId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: mediaUrl,
            caption: fullText(post),
            access_token: env.meta.accessToken,
          }),
        }
      );
      const created = (await createRes.json()) as { id?: string; error?: { message?: string } };
      if (!createRes.ok || !created.id) {
        return { ok: false, error: created.error?.message ?? `فشل إنشاء الوسيط (${createRes.status})` };
      }

      const pubRes = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${env.meta.igUserId}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id: created.id, access_token: env.meta.accessToken }),
        }
      );
      const published = (await pubRes.json()) as { id?: string; error?: { message?: string } };
      if (!pubRes.ok || !published.id) {
        return { ok: false, error: published.error?.message ?? `فشل النشر (${pubRes.status})` };
      }
      return { ok: true, externalId: published.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

/** فيسبوك — منشور نصي على صفحة الشركة (يُستخدم كنسخة مساندة لإنستقرام) */
export async function publishToFacebookPage(post: Post): Promise<ActionResult> {
  if (env.dryRun || !env.meta.accessToken || !env.meta.pageId) {
    return { ok: true, simulated: true, externalId: `sim-fb-${post.id}` };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${env.meta.pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: fullText(post), access_token: env.meta.accessToken }),
    });
    const data = (await res.json()) as { id?: string; error?: { message?: string } };
    if (!res.ok || !data.id) return { ok: false, error: data.error?.message ?? `فشل النشر (${res.status})` };
    return { ok: true, externalId: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
