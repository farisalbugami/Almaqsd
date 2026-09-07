/**
 * واجهة الأوامر — لتشغيل أي مرحلة يدويًا:
 *   npm run cli plan:seed [YYYY-MM-DD]
 *   npm run cli plan:show
 *   npm run cli content:generate
 *   npm run cli approvals:digest
 *   npm run cli approvals:reply "موافق الكل"
 *   npm run cli publish:due
 *   npm run cli ads:plan
 *   npm run cli ads:provision
 *   npm run cli ads:sync
 *   npm run cli ads:optimize
 *   npm run cli leads:add "الاسم" 0551234567 "مجمع تجاري" "10 – 50" "الرياض"
 *   npm run cli sequences:run
 *   npm run cli report:daily | report:weekly
 *   npm run cli status
 */
import { campaign, env } from "./config.js";
import { logger } from "./logger.js";
import { ads as adsRepo, leads as leadsRepo, posts as postsRepo } from "./db/repo.js";
import { db } from "./db/index.js";
import { campaignStartDate, seedPlan } from "./content/planner.js";
import { expireUnapproved, generateDuePosts, publishDuePosts } from "./content/pipeline.js";
import { handleApprovalReply, sendApprovalDigest } from "./approvals/service.js";
import { buildAdPlan, provisionCampaigns } from "./ads/planner.js";
import { runOptimizer, syncMetrics } from "./ads/optimizer.js";
import { intakeLead, runDueSequenceSteps } from "./leads/pipeline.js";
import { buildDailyReport, buildWeeklyReport } from "./reports/index.js";
import { fmtRiyadh } from "./time.js";
import type { Post } from "./types.js";

const [command, ...args] = process.argv.slice(2);

function table(rows: string[]): void {
  for (const r of rows) console.log(r);
}

async function main(): Promise<void> {
  switch (command) {
    case "plan:seed": {
      const result = seedPlan(args[0]);
      console.log(`✅ أُنشئ ${result.created} منشورًا مخططًا (تُجووزت ${result.skipped} لوجودها) — بداية الحملة ${result.startDate}`);
      break;
    }

    case "plan:show": {
      const rows = db
        .prepare("SELECT * FROM posts ORDER BY scheduled_at ASC LIMIT ?")
        .all(Number(args[0] ?? 30)) as Post[];
      console.log(`بداية الحملة: ${campaignStartDate() ?? "—"} · إجمالي المنشورات: ${Object.values(postsRepo.countsByStatus()).reduce((a, b) => a + b, 0)}`);
      table(
        rows.map(
          (p) =>
            `${String(p.id).padStart(3)} | ${fmtRiyadh(p.scheduled_at)} | ${p.channel.padEnd(9)} | ${p.status.padEnd(16)} | ${p.topic.slice(0, 45)}`
        )
      );
      break;
    }

    case "content:generate": {
      const r = await generateDuePosts();
      console.log(`✅ وُلّد ${r.generated} منشورًا — فشل ${r.failed}`);
      break;
    }

    case "approvals:digest": {
      const r = await sendApprovalDigest();
      console.log(`📨 أُرسل طلب موافقة لـ ${r.sent} منشورًا`);
      break;
    }

    case "approvals:reply": {
      const from = env.whatsapp.approvers[0] ?? "cli";
      const reply = await handleApprovalReply(from, args.join(" "));
      console.log(reply ?? "لم يُفهم الأمر");
      break;
    }

    case "publish:due": {
      const r = await publishDuePosts();
      console.log(`📤 نُشر ${r.published} — فشل ${r.failed}`);
      break;
    }

    case "content:expire": {
      console.log(`⏳ أُسقط ${expireUnapproved()} منشورًا لم يُعتمد`);
      break;
    }

    case "ads:plan": {
      const plan = buildAdPlan();
      const monthly = plan.reduce((s, p) => s + p.spec.dailyBudget * 30, 0);
      table(
        plan.map(
          (p) =>
            `${p.platform.padEnd(9)} | ${p.spec.dailyBudget.toFixed(0).padStart(4)} ريال/يوم | ${p.spec.audienceId} | ${p.spec.name}`
        )
      );
      console.log(`\nالإجمالي الشهري المخطط: ${monthly.toFixed(0)} من سقف ${campaign.budget.monthlyTotal} ${campaign.budget.currency}`);
      break;
    }

    case "ads:provision": {
      const r = await provisionCampaigns();
      console.log(`✅ أُنشئ برمجيًا: ${r.created} — بانتظار إنشاء يدوي: ${r.manual}`);
      break;
    }

    case "ads:sync": {
      const r = await syncMetrics();
      console.log(`📊 زُومنت ${r.synced} حملة`);
      break;
    }

    case "ads:optimize": {
      const actions = await runOptimizer();
      if (actions.length === 0) console.log("لا قرارات — كل الحملات ضمن الحدود");
      else table(actions.map((a) => `${a.action}: ${a.campaign}\n   ${a.reason}`));
      break;
    }

    case "ads:list": {
      table(
        adsRepo.all().map((c) => {
          const t = adsRepo.totals(c.id);
          const cpl = t.leads > 0 ? (t.spend / t.leads).toFixed(0) : "—";
          return `${String(c.id).padStart(3)} | ${c.platform.padEnd(9)} | ${c.status.padEnd(7)} | ${c.daily_budget
            .toFixed(0)
            .padStart(4)}/يوم | إنفاق ${t.spend.toFixed(0)} | عملاء ${t.leads} | تكلفة ${cpl} | ${c.name}`;
        })
      );
      break;
    }

    case "leads:add": {
      const [name, phone, type, units, city] = args;
      if (!name || !phone) {
        console.log('الاستخدام: leads:add "الاسم" 0551234567 "مجمع تجاري" "10 – 50" "الرياض"');
        break;
      }
      const r = await intakeLead({
        name,
        phone,
        source: "landing",
        propertyType: type ?? null,
        units: units ?? null,
        city: city ?? null,
      });
      console.log(`✅ عميل محتمل #${r.leadId} — ${r.score} نقطة${r.hot ? " 🔥 ساخن" : r.qualified ? " ✅ مؤهل" : ""}`);
      break;
    }

    case "leads:list": {
      table(
        leadsRepo.since("1970-01-01").map(
          (l) =>
            `${String(l.id).padStart(3)} | ${l.status.padEnd(10)} | ${String(l.score).padStart(3)} | ${l.phone} | ${l.name} | ${l.property_type ?? "—"}`
        )
      );
      break;
    }

    case "sequences:run": {
      const r = await runDueSequenceSteps();
      console.log(`📬 نُفّذت ${r.executed} خطوة متابعة`);
      break;
    }

    case "report:daily":
      console.log(buildDailyReport());
      break;

    case "report:weekly":
      console.log(buildWeeklyReport());
      break;

    case "status": {
      console.log(`الشركة: ${campaign.company.name}`);
      console.log(`بداية الحملة: ${campaignStartDate() ?? "لم تبدأ"}`);
      console.log(`DRY_RUN: ${env.dryRun}`);
      console.log("\nالمحتوى:", JSON.stringify(postsRepo.countsByStatus(), null, 2));
      console.log("العملاء المحتملون:", JSON.stringify(leadsRepo.countsByStatus(), null, 2));
      console.log(`الحملات الإعلانية: ${adsRepo.all().length}`);
      break;
    }

    default:
      console.log(
        [
          "الأوامر المتاحة:",
          "  plan:seed [YYYY-MM-DD]   بناء تقويم المحتوى",
          "  plan:show [n]            عرض الجدول",
          "  content:generate         توليد المحتوى المستحق",
          "  content:expire           إسقاط ما لم يُعتمد",
          "  approvals:digest         إرسال طلب الموافقة",
          '  approvals:reply "نص"     محاكاة رد المعتمِد',
          "  publish:due              نشر المعتمد المستحق",
          "  ads:plan                 عرض خطة الحملات",
          "  ads:provision            إنشاء الحملات",
          "  ads:list                 عرض الحملات وأدائها",
          "  ads:sync                 مزامنة الأرقام",
          "  ads:optimize             تشغيل قواعد الإيقاف",
          "  leads:add ...            إضافة عميل محتمل",
          "  leads:list               عرض العملاء",
          "  sequences:run            تنفيذ خطوات المتابعة",
          "  report:daily|weekly      طباعة التقرير",
          "  status                   ملخص الحالة",
        ].join("\n")
      );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "فشل الأمر");
    process.exit(1);
  });
