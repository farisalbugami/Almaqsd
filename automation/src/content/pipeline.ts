import { campaign } from "../config.js";
import { logger } from "../logger.js";
import { posts as postsRepo } from "../db/repo.js";
import { publisherFor } from "../channels/registry.js";
import { notifyApprovers } from "../messaging/whatsapp.js";
import { generateForPost, makeApprovalCode } from "./generator.js";

/** يولّد محتوى المنشورات التي اقترب موعدها (وكذلك ما طُلب تعديله) */
export async function generateDuePosts(): Promise<{ generated: number; failed: number }> {
  const due = postsRepo.dueForGeneration(campaign.approvals.generateLeadDays);
  let generated = 0;
  let failed = 0;

  for (const post of due) {
    const withNote = post.revision_note
      ? { ...post, topic: `${post.topic}\n\nملاحظة تعديل من الإدارة: ${post.revision_note}` }
      : post;

    const outcome = await generateForPost(withNote);
    if (!outcome.ok || !outcome.content) {
      postsRepo.setStatus(post.id, "planned", { error: outcome.reason ?? "سبب غير معروف" });
      failed++;
      logger.warn({ postId: post.id, reason: outcome.reason }, "فشل توليد المحتوى");
      continue;
    }

    const c = outcome.content;
    postsRepo.saveGenerated(
      post.id,
      {
        hook: c.hook,
        body: c.body,
        cta: c.cta,
        hashtags: c.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "),
        media_brief: c.mediaBrief,
      },
      makeApprovalCode(post.id)
    );
    generated++;
  }

  if (generated || failed) logger.info({ generated, failed }, "اكتمل توليد المحتوى");
  return { generated, failed };
}

/** ينشر المنشورات المعتمدة التي حان موعدها */
export async function publishDuePosts(): Promise<{ published: number; failed: number }> {
  const due = postsRepo.dueForPublish();
  let published = 0;
  let failed = 0;

  for (const post of due) {
    const publisher = publisherFor(post.channel);
    const result = await publisher.publish(post);

    if (result.ok) {
      postsRepo.markPublished(post.id, result.externalId);
      published++;
      logger.info(
        { postId: post.id, channel: post.channel, simulated: result.simulated ?? false },
        "تم النشر"
      );
    } else {
      postsRepo.setStatus(post.id, "failed", { error: result.error ?? "فشل غير محدد" });
      failed++;
      await notifyApprovers(
        `❌ *فشل نشر*\nالرمز: ${post.approval_code}\nالقناة: ${post.channel}\nالسبب: ${result.error ?? "غير محدد"}`
      );
    }
  }

  return { published, failed };
}

/** يُسقط المحتوى الذي لم يُعتمد خلال المهلة */
export function expireUnapproved(): number {
  const n = postsRepo.expireStale(campaign.approvals.expireHours);
  if (n > 0) logger.info({ expired: n }, "أُسقط محتوى لم يُعتمد في الوقت");
  return n;
}
