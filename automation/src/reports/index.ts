import { campaign, env } from "../config.js";
import { logger } from "../logger.js";
import { ads as adsRepo, leads as leadsRepo, posts as postsRepo } from "../db/repo.js";
import { sendEmail } from "../messaging/email.js";
import { sendWhatsapp } from "../messaging/whatsapp.js";
import { daysAgoIso, ymd } from "../time.js";

const PLATFORM_LABEL: Record<string, string> = {
  meta: "ميتا",
  linkedin: "لينكدإن",
  tiktok: "تيك توك",
  snapchat: "سناب",
};

function money(n: number): string {
  return `${n.toFixed(0)} ${campaign.budget.currency}`;
}

export function buildDailyReport(): string {
  const since = daysAgoIso(1);
  const newLeads = leadsRepo.since(since);
  const published = postsRepo.publishedSince(since);
  const metrics = adsRepo.metricsSince(ymd(new Date(Date.now() - 86400_000)));
  const actions = adsRepo.actionsSince(since);
  const statuses = leadsRepo.countsByStatus();

  const spend = metrics.reduce((s, m) => s + m.spend, 0);
  const adLeads = metrics.reduce((s, m) => s + m.leads, 0);
  const qualified = newLeads.filter((l) => l.score >= campaign.leadScoring.qualifiedThreshold).length;

  const lines = [
    `📈 *تقرير المقصد اليومي*`,
    `${new Date().toISOString().slice(0, 10)}`,
    "",
    `👥 عملاء محتملون جدد: *${newLeads.length}* (مؤهلون: ${qualified})`,
    `📤 منشورات نُشرت: *${published.length}*`,
    `💸 إنفاق إعلاني أمس: *${money(spend)}*`,
    adLeads > 0 ? `🎯 تكلفة العميل المحتمل: *${money(spend / adLeads)}*` : "🎯 تكلفة العميل المحتمل: —",
    "",
    "*حسب المنصة*",
    ...metrics
      .filter((m) => m.spend > 0 || m.leads > 0)
      .map(
        (m) =>
          `• ${PLATFORM_LABEL[m.platform] ?? m.platform}: ${money(m.spend)} · ${m.leads} عميل · ${m.clicks} نقرة`
      ),
    "",
    "*خط الأنابيب*",
    `• جديد: ${statuses.new ?? 0} · تم التواصل: ${statuses.contacted ?? 0} · مؤهل: ${statuses.qualified ?? 0}`,
    `• اجتماع: ${statuses.meeting ?? 0} · تم التعاقد: ${statuses.won ?? 0} · مغلق: ${statuses.lost ?? 0}`,
  ];

  if (actions.length > 0) {
    lines.push("", "*قرارات آلية اليوم*", ...actions.slice(0, 6).map((a) => `• ${a.action}: ${a.reason}`));
  }

  if (newLeads.length > 0) {
    lines.push("", "*أبرز العملاء الجدد*");
    for (const l of newLeads.slice(0, 5)) {
      lines.push(`• ${l.name} — ${l.phone} · ${l.property_type ?? "—"} · ${l.score} نقطة`);
    }
  }

  return lines.join("\n");
}

export function buildWeeklyReport(): string {
  const since = daysAgoIso(7);
  const sinceYmd = ymd(new Date(Date.now() - 7 * 86400_000));
  const weekLeads = leadsRepo.since(since);
  const published = postsRepo.publishedSince(since);
  const metrics = adsRepo.metricsSince(sinceYmd);
  const actions = adsRepo.actionsSince(since);

  const spend = metrics.reduce((s, m) => s + m.spend, 0);
  const adLeads = metrics.reduce((s, m) => s + m.leads, 0);
  const qualified = weekLeads.filter((l) => l.score >= campaign.leadScoring.qualifiedThreshold);
  const meetings = weekLeads.filter((l) => l.status === "meeting" || l.status === "won").length;
  const monthlyPace = (spend / 7) * 30;

  return [
    `📊 *تقرير المقصد الأسبوعي*`,
    "",
    `👥 عملاء محتملون: *${weekLeads.length}* — مؤهلون: *${qualified.length}* (${
      weekLeads.length ? Math.round((qualified.length / weekLeads.length) * 100) : 0
    }%)`,
    `🤝 اجتماعات وتعاقدات: *${meetings}*`,
    `📤 منشورات: *${published.length}*`,
    `💸 الإنفاق: *${money(spend)}* — الوتيرة الشهرية: ${money(monthlyPace)} من ${money(campaign.budget.monthlyTotal)}`,
    adLeads > 0 ? `🎯 متوسط تكلفة العميل: *${money(spend / adLeads)}*` : "",
    "",
    "*الأداء حسب المنصة*",
    ...metrics.map((m) => {
      const cpl = m.leads > 0 ? money(m.spend / m.leads) : "—";
      return `• ${PLATFORM_LABEL[m.platform] ?? m.platform}: ${money(m.spend)} · ${m.leads} عميل · تكلفة العميل ${cpl}`;
    }),
    "",
    `⚙️ قرارات آلية هذا الأسبوع: ${actions.length}`,
    monthlyPace > campaign.budget.monthlyTotal * 1.1
      ? `⚠️ الوتيرة الحالية تتجاوز سقف الميزانية الشهرية — يلزم خفض الميزانيات اليومية.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendDailyReport(): Promise<void> {
  const body = buildDailyReport();
  if (env.whatsapp.reportNumber) await sendWhatsapp(env.whatsapp.reportNumber, body);
  if (env.smtp.reportEmail) await sendEmail(env.smtp.reportEmail, "تقرير المقصد اليومي", body);
  logger.info("أُرسل التقرير اليومي");
}

export async function sendWeeklyReport(): Promise<void> {
  const body = buildWeeklyReport();
  if (env.whatsapp.reportNumber) await sendWhatsapp(env.whatsapp.reportNumber, body);
  if (env.smtp.reportEmail) await sendEmail(env.smtp.reportEmail, "تقرير المقصد الأسبوعي", body);
  logger.info("أُرسل التقرير الأسبوعي");
}
