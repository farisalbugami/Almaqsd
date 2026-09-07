import { campaign } from "../config.js";
import { logger } from "../logger.js";
import { ads as adsRepo } from "../db/repo.js";
import { notifyApprovers } from "../messaging/whatsapp.js";
import { ymd } from "../time.js";
import { adapterFor } from "./registry.js";

export interface OptimizerAction {
  campaign: string;
  action: "pause" | "cut_budget" | "flag";
  reason: string;
}

/** يسحب أرقام الأمس من كل منصة تدعم القراءة البرمجية */
export async function syncMetrics(): Promise<{ synced: number }> {
  const yesterday = ymd(new Date(Date.now() - 86400_000));
  let synced = 0;

  for (const c of adsRepo.all()) {
    if (!c.external_id) continue;
    const adapter = adapterFor(c.platform);
    const insights = await adapter.fetchInsights(c.external_id, yesterday, yesterday);
    if (!insights) continue;

    adsRepo.recordMetrics({
      ad_campaign_id: c.id,
      date: yesterday,
      spend: insights.spend,
      impressions: insights.impressions,
      clicks: insights.clicks,
      leads: insights.leads,
    });
    synced++;
  }

  logger.info({ synced, date: yesterday }, "مزامنة أرقام الإعلانات");
  return { synced };
}

/** تسجيل أرقام يدوية لمنصة لا تُقرأ برمجيًا */
export function recordManualMetrics(
  externalId: string,
  m: { spend: number; impressions: number; clicks: number; leads: number },
  dateYmd = ymd(new Date(Date.now() - 86400_000))
): boolean {
  const target = adsRepo.all().find((c) => c.external_id === externalId);
  if (!target) return false;
  adsRepo.recordMetrics({ ad_campaign_id: target.id, date: dateYmd, ...m });
  return true;
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime()) / 86400_000;
}

/**
 * محرك قواعد إيقاف الخسارة — ينفّذ القواعد المعرّفة في campaign.yaml:
 *  ١. إعلان أنفق حد الإنفاق بلا عميل محتمل واحد → يُوقف.
 *  ٢. إعلان تجاوزت تكلفة عميله ضعف متوسط منصته بعد مدة النضج → يُوقف.
 *  ٣. منصة بلا عميل محتمل خلال مدة المراجعة → تُخفَّض ميزانيتها.
 */
export async function runOptimizer(): Promise<OptimizerAction[]> {
  const rules = campaign.optimizer;
  const platformCpl = adsRepo.platformCpl();
  const actions: OptimizerAction[] = [];

  for (const c of adsRepo.active()) {
    const totals = adsRepo.totals(c.id);
    const age = daysSince(c.created_at);

    /* القاعدة ١ — إنفاق بلا نتيجة */
    if (totals.spend >= rules.spendNoLeadThreshold && totals.leads === 0) {
      const reason = `أنفق ${totals.spend.toFixed(0)} ريال بلا عميل محتمل واحد (الحد ${rules.spendNoLeadThreshold})`;
      await pauseCampaign(c.id, c.platform, c.external_id, c.name, reason, actions);
      continue;
    }

    /* القاعدة ٢ — تكلفة عميل مرتفعة بعد النضج */
    if (age >= rules.minAgeDays && totals.leads > 0) {
      const cpl = totals.spend / totals.leads;
      const avg = platformCpl[c.platform];
      if (avg && Number.isFinite(avg) && cpl > avg * rules.cplMultiplierCap) {
        const reason = `تكلفة العميل ${cpl.toFixed(0)} ريال — أعلى من ${rules.cplMultiplierCap}× متوسط المنصة (${avg.toFixed(0)})`;
        await pauseCampaign(c.id, c.platform, c.external_id, c.name, reason, actions);
        continue;
      }
    }
  }

  /* القاعدة ٣ — منصة بلا عملاء مؤهلين خلال مدة المراجعة */
  const sinceDate = ymd(new Date(Date.now() - rules.channelReviewDays * 86400_000));
  for (const row of adsRepo.metricsSince(sinceDate)) {
    if (row.spend > 0 && row.leads === 0) {
      const affected = adsRepo.active().filter((c) => c.platform === row.platform);
      for (const c of affected) {
        const newBudget = Number((c.daily_budget * (1 - rules.channelBudgetCutPct / 100)).toFixed(2));
        const adapter = adapterFor(c.platform);
        if (c.external_id) await adapter.setDailyBudget(c.external_id, newBudget);
        adsRepo.setBudget(c.id, newBudget);
        const reason = `منصة ${row.platform} بلا عميل محتمل خلال ${rules.channelReviewDays} يومًا — خُفّضت الميزانية ${rules.channelBudgetCutPct}%`;
        adsRepo.logAction(c.id, "cut_budget", reason);
        actions.push({ campaign: c.name, action: "cut_budget", reason });
      }
    }
  }

  if (actions.length > 0) {
    const body = [
      "⚙️ *قرارات محرك التحسين*",
      "",
      ...actions.map((a) => `• ${a.action === "pause" ? "إيقاف" : "خفض ميزانية"} — ${a.campaign}\n  السبب: ${a.reason}`),
    ].join("\n");
    await notifyApprovers(body);
  }

  logger.info({ actions: actions.length }, "اكتمل محرك التحسين");
  return actions;
}

async function pauseCampaign(
  id: number,
  platform: "meta" | "linkedin" | "tiktok" | "snapchat",
  externalId: string | null,
  name: string,
  reason: string,
  sink: OptimizerAction[]
): Promise<void> {
  const adapter = adapterFor(platform);
  if (externalId) await adapter.pause(externalId);
  adsRepo.setStatus(id, "paused");
  adsRepo.logAction(id, "pause", reason);
  sink.push({ campaign: name, action: "pause", reason });
}

/** يمنع رفع ميزانية إعلان أكثر من الحد المسموح خلال فترة التهدئة */
export async function requestBudgetIncrease(campaignId: number, targetBudget: number): Promise<{ ok: boolean; applied: number; note: string }> {
  const rules = campaign.optimizer;
  const c = adsRepo.byId(campaignId);
  if (!c) return { ok: false, applied: 0, note: "الحملة غير موجودة" };

  if (c.last_budget_change_at && daysSince(c.last_budget_change_at) < rules.budgetChangeCooldownDays) {
    return { ok: false, applied: c.daily_budget, note: `فترة التهدئة (${rules.budgetChangeCooldownDays} أيام) لم تنتهِ` };
  }

  const cap = c.daily_budget * (1 + rules.maxBudgetIncreasePct / 100);
  const applied = Number(Math.min(targetBudget, cap).toFixed(2));
  const adapter = adapterFor(c.platform);
  if (c.external_id) await adapter.setDailyBudget(c.external_id, applied);
  adsRepo.setBudget(campaignId, applied);
  adsRepo.logAction(campaignId, "budget_increase", `من ${c.daily_budget} إلى ${applied} ريال`);

  return {
    ok: true,
    applied,
    note: applied < targetBudget ? `حُدّت الزيادة عند ${rules.maxBudgetIncreasePct}% لتفادي إعادة مرحلة التعلّم` : "طُبّقت الزيادة",
  };
}
