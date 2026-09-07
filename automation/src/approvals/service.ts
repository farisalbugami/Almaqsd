import { campaign } from "../config.js";
import { logger } from "../logger.js";
import { approvals as approvalRepo, posts } from "../db/repo.js";
import { notifyApprovers, sendWhatsapp } from "../messaging/whatsapp.js";
import { fmtRiyadh } from "../time.js";
import type { Post } from "../types.js";

const CHANNEL_LABEL: Record<string, string> = {
  linkedin: "لينكدإن",
  instagram: "إنستقرام",
  tiktok: "تيك توك",
  snapchat: "سناب",
};

const TYPE_LABEL: Record<string, string> = {
  educational: "تعليمي",
  proof: "إثبات",
  promotional: "ترويج",
};

function preview(post: Post, maxChars = 220): string {
  const text = (post.body ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

/** يرسل طلب الموافقة اليومي إلى المعتمِدين */
export async function sendApprovalDigest(): Promise<{ sent: number }> {
  const pending = posts.awaitingApprovalRequest(15);
  if (pending.length === 0) {
    logger.info("لا يوجد محتوى ينتظر الموافقة");
    return { sent: 0 };
  }

  const lines: string[] = [
    `🗂️ *طلب موافقة — ${campaign.company.shortName}*`,
    `عدد المنشورات الجاهزة: ${pending.length}`,
    "",
  ];

  for (const post of pending) {
    lines.push(
      `*${post.approval_code}* · ${CHANNEL_LABEL[post.channel] ?? post.channel} · ${TYPE_LABEL[post.content_type] ?? ""}`,
      `🗓️ ${fmtRiyadh(post.scheduled_at)} · الشريحة ${post.audience_id}`,
      `📝 ${preview(post)}`,
      ""
    );
    posts.setStatus(post.id, "pending_approval");
  }

  lines.push(
    "— الأوامر —",
    "`موافق A001` أو `موافق الكل`",
    "`رفض A001 السبب`",
    "`تعديل A001 الملاحظة`",
    "`عرض A001` لقراءة النص كاملًا",
    "",
    `⏳ ما لا يُعتمد خلال ${campaign.approvals.expireHours} ساعة يسقط تلقائيًا.`
  );

  const body = lines.join("\n");
  await notifyApprovers(body);
  approvalRepo.record("approvers", pending.map((p) => p.id));
  logger.info({ count: pending.length }, "أُرسل طلب الموافقة");
  return { sent: pending.length };
}

/* ───────────────────────── معالجة ردود واتساب ───────────────────────── */

const CODE_RE = /\b([A-Za-z]\d{3,})\b/;

export async function handleApprovalReply(from: string, rawText: string): Promise<string | null> {
  const text = rawText.trim();
  const normalized = text.replace(/[أإآ]/g, "ا").toLowerCase();

  if (/^(حاله|حالة|status)\b/.test(normalized)) {
    return statusSummary();
  }

  const wantsAll = /الكل/.test(normalized); // \b لا يعمل مع الحروف العربية
  const code = CODE_RE.exec(text)?.[1]?.toUpperCase();

  /* موافقة */
  if (/^(موافق|نعم|اعتمد|ok|approve)/.test(normalized)) {
    if (wantsAll) {
      const pending = posts.pendingApproval();
      pending.forEach((p) => posts.markApproved(p.id, from));
      logger.info({ count: pending.length, by: from }, "اعتماد جماعي");
      return `✅ تم اعتماد ${pending.length} منشورًا. سيُنشر كل منشور في موعده.`;
    }
    if (!code) return "اكتب رمز المنشور، مثال: موافق A001";
    const post = posts.byApprovalCode(code);
    if (!post) return `لم أجد منشورًا بالرمز ${code} في انتظار الموافقة.`;
    posts.markApproved(post.id, from);
    return `✅ اعتُمد ${code} — سيُنشر ${fmtRiyadh(post.scheduled_at)}.`;
  }

  /* رفض */
  if (/^(رفض|لا|الغاء|إلغاء|reject)/.test(normalized)) {
    if (!code) return "اكتب رمز المنشور، مثال: رفض A001 السبب";
    const post = posts.byApprovalCode(code);
    if (!post) return `لم أجد منشورًا بالرمز ${code}.`;
    const reason = text.replace(CODE_RE, "").replace(/^\S+\s*/, "").trim();
    posts.setStatus(post.id, "rejected", { revision_note: reason || null });
    return `🚫 رُفض ${code}. لن يُنشر.`;
  }

  /* تعديل — يعود إلى قائمة التوليد بملاحظة */
  if (/^(تعديل|عدل|revise)/.test(normalized)) {
    if (!code) return "اكتب رمز المنشور، مثال: تعديل A001 اجعل النص أقصر";
    const post = posts.byApprovalCode(code);
    if (!post) return `لم أجد منشورًا بالرمز ${code}.`;
    const note = text.replace(CODE_RE, "").replace(/^\S+\s*/, "").trim();
    if (!note) return "اكتب الملاحظة بعد الرمز حتى أعيد الكتابة وفقها.";
    posts.setStatus(post.id, "revise", { revision_note: note });
    return `✍️ سأعيد كتابة ${code} وفق ملاحظتك، ويصلك للاعتماد مجددًا.`;
  }

  /* عرض النص كاملًا */
  if (/^(عرض|اعرض|show)/.test(normalized)) {
    if (!code) return "اكتب رمز المنشور، مثال: عرض A001";
    const post = posts.byApprovalCode(code) ?? findAnyByCode(code);
    if (!post) return `لم أجد منشورًا بالرمز ${code}.`;
    return [
      `*${code}* · ${CHANNEL_LABEL[post.channel] ?? post.channel}`,
      `🗓️ ${fmtRiyadh(post.scheduled_at)}`,
      "",
      post.body ?? "",
      "",
      `دعوة الفعل: ${post.cta ?? "—"}`,
      post.hashtags ? `الوسوم: ${post.hashtags}` : "",
      `🎬 الوسيط: ${post.media_brief ?? "—"}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  /* تأكيد نشر يدوي */
  if (/^(تم|نشرت|done)/.test(normalized) && code) {
    const post = findAnyByCode(code);
    if (!post) return `لم أجد منشورًا بالرمز ${code}.`;
    posts.markPublished(post.id, `manual-confirmed-${post.id}`);
    return `📌 سُجّل نشر ${code}.`;
  }

  return null; // ليست رسالة موافقة — تُمرَّر لمعالج آخر
}

function findAnyByCode(code: string): Post | undefined {
  const all = posts.pendingApproval();
  return all.find((p) => p.approval_code === code);
}

function statusSummary(): string {
  const counts = posts.countsByStatus();
  const label: Record<string, string> = {
    planned: "مخطّط",
    generated: "مولّد",
    pending_approval: "بانتظار الموافقة",
    approved: "معتمد",
    published: "منشور",
    rejected: "مرفوض",
    revise: "قيد التعديل",
    expired: "منتهٍ",
    failed: "فشل",
  };
  const lines = Object.entries(counts).map(([k, v]) => `• ${label[k] ?? k}: ${v}`);
  return [`📊 *حالة المحتوى*`, ...lines].join("\n");
}

export async function replyTo(from: string, text: string): Promise<void> {
  await sendWhatsapp(from, text);
}
