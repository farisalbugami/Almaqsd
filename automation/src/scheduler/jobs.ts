import cron, { type ScheduledTask } from "node-cron";
import { campaign, env } from "../config.js";
import { logger } from "../logger.js";
import { sendApprovalDigest } from "../approvals/service.js";
import { expireUnapproved, generateDuePosts, publishDuePosts } from "../content/pipeline.js";
import { checkSlaBreaches, runDueSequenceSteps } from "../leads/pipeline.js";
import { runOptimizer, syncMetrics } from "../ads/optimizer.js";
import { sendDailyReport, sendWeeklyReport } from "../reports/index.js";

const TZ = env.tz;

/** يحوّل "HH:MM" إلى تعبير cron يومي */
function dailyAt(hhmm: string): string {
  const parts = hhmm.split(":");
  return `${Number(parts[1] ?? 0)} ${Number(parts[0] ?? 0)} * * *`;
}

function weeklyAt(hhmm: string, dayOfWeek: number): string {
  const parts = hhmm.split(":");
  return `${Number(parts[1] ?? 0)} ${Number(parts[0] ?? 0)} * * ${dayOfWeek}`;
}

async function guard(name: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.error({ job: name, err: err instanceof Error ? err.message : String(err) }, "فشل تنفيذ مهمة مجدولة");
  }
}

export function startScheduler(): ScheduledTask[] {
  const tasks: ScheduledTask[] = [];
  const add = (expr: string, name: string, fn: () => Promise<unknown>) => {
    tasks.push(cron.schedule(expr, () => void guard(name, fn), { timezone: TZ }));
    logger.info({ job: name, cron: expr, tz: TZ }, "مهمة مجدولة");
  };

  // توليد المحتوى قبل موعد النشر
  add("0 7 * * *", "generate-content", generateDuePosts);

  // طلب الموافقة اليومي
  if (campaign.approvals.required) {
    add(dailyAt(campaign.approvals.digestTime), "approval-digest", sendApprovalDigest);
  }

  // النشر كل عشر دقائق للمنشورات المعتمدة التي حان وقتها
  add("*/10 * * * *", "publish-due", publishDuePosts);

  // خطوات متابعة العملاء المحتملين
  add("*/15 * * * *", "sequence-steps", runDueSequenceSteps);

  // مراقبة مهلة الرد الأول
  add("*/30 * * * *", "sla-check", checkSlaBreaches);

  // إسقاط المحتوى غير المعتمد
  add("5 * * * *", "expire-unapproved", async () => expireUnapproved());

  // مزامنة أرقام الإعلانات ثم تشغيل محرك التحسين
  add("0 6 * * *", "sync-metrics", syncMetrics);
  add("30 7 * * *", "optimizer", runOptimizer);

  // التقارير
  add(dailyAt(campaign.reports.dailyTime), "daily-report", sendDailyReport);
  add(weeklyAt(campaign.reports.weeklyTime, campaign.reports.weeklyDay), "weekly-report", sendWeeklyReport);

  logger.info({ jobs: tasks.length }, "المجدول يعمل");
  return tasks;
}
