import { campaign, env } from "./config.js";
import { logger } from "./logger.js";
import { createServer } from "./server.js";
import { startScheduler } from "./scheduler/jobs.js";
import { campaignStartDate, seedPlan } from "./content/planner.js";
import { isWhatsappConfigured } from "./messaging/whatsapp.js";
import { isEmailConfigured } from "./messaging/email.js";

function readiness(): void {
  const rows: [string, boolean][] = [
    ["توليد المحتوى (Claude)", Boolean(env.anthropicApiKey)],
    ["واتساب الأعمال", isWhatsappConfigured()],
    ["البريد الإلكتروني", isEmailConfigured()],
    ["ميتا (نشر وإعلانات)", Boolean(env.meta.accessToken)],
    ["لينكدإن", Boolean(env.linkedin.accessToken)],
  ];
  logger.info("── جاهزية القنوات ──");
  for (const [name, ready] of rows) {
    logger.info(`${ready ? "✅" : "⚪"} ${name}${ready ? "" : " (وضع المحاكاة)"}`);
  }
  if (env.dryRun) logger.warn("DRY_RUN مفعّل — لا نشر ولا إنفاق فعلي. اضبطه على false عند الإطلاق.");
}

function main(): void {
  logger.info(`🚀 نظام أتمتة حملات ${campaign.company.shortName}`);
  readiness();

  if (!campaignStartDate()) {
    logger.info("لا توجد خطة محتوى — يجري بناؤها الآن");
    seedPlan();
  }

  const app = createServer();
  app.listen(env.port, () => logger.info({ port: env.port }, "الخادم يستمع"));

  startScheduler();
}

main();
