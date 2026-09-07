import { env } from "../config.js";
import { logger } from "../logger.js";
import { notifyApprovers } from "../messaging/whatsapp.js";
import type { ActionResult } from "../types.js";
import type { AdsAdapter, CampaignSpec, Insights } from "./types.js";

/**
 * لينكدإن: الإنشاء البرمجي للحملة يتطلب مجموعة حملات وتصاميم معتمدة مسبقًا،
 * لذلك يُنشأ الإعلان يدويًا مرة واحدة ثم يُسجَّل معرّفه في النظام،
 * بينما تبقى المتابعة والإيقاف وتعديل الميزانية آليّة بالكامل.
 */
export const linkedinAds: AdsAdapter = {
  platform: "linkedin",

  isConfigured(): boolean {
    return Boolean(env.linkedin.accessToken && env.linkedin.adAccountId);
  },

  async createCampaign(spec: CampaignSpec): Promise<ActionResult> {
    const brief = [
      `🧾 *حملة لينكدإن للإنشاء اليدوي*`,
      `الاسم: ${spec.name}`,
      `الهدف: ${spec.objective}`,
      `الميزانية اليومية: ${spec.dailyBudget.toFixed(0)} ريال`,
      `الشريحة: ${spec.audienceId}`,
      "",
      `الاستهداف: ${spec.targetingBrief}`,
      "",
      `أنشئها في Campaign Manager ثم أرسل: ربط لينكدإن <المعرّف> ${spec.name}`,
    ].join("\n");
    await notifyApprovers(brief);
    logger.info({ name: spec.name }, "أُرسل ملخص حملة لينكدإن للإنشاء اليدوي");
    return { ok: true, simulated: true, externalId: undefined };
  },

  async fetchInsights(externalId: string, sinceYmd: string, untilYmd: string): Promise<Insights | null> {
    if (env.dryRun || !this.isConfigured()) return null;
    try {
      const [sy, sm, sd] = sinceYmd.split("-");
      const [uy, um, ud] = untilYmd.split("-");
      const url =
        `https://api.linkedin.com/rest/adAnalytics` +
        `?q=analytics&pivot=CAMPAIGN&timeGranularity=ALL` +
        `&dateRange=(start:(year:${sy},month:${Number(sm)},day:${Number(sd)}),` +
        `end:(year:${uy},month:${Number(um)},day:${Number(ud)}))` +
        `&campaigns=List(urn%3Ali%3AsponsoredCampaign%3A${externalId})` +
        `&fields=costInLocalCurrency,impressions,clicks,oneClickLeads`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${env.linkedin.accessToken}`,
          "LinkedIn-Version": "202506",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      });
      if (!res.ok) {
        logger.error({ status: res.status }, "فشل جلب بيانات لينكدإن");
        return null;
      }
      const json = (await res.json()) as {
        elements?: { costInLocalCurrency?: string; impressions?: number; clicks?: number; oneClickLeads?: number }[];
      };
      const row = json.elements?.[0];
      if (!row) return { spend: 0, impressions: 0, clicks: 0, leads: 0 };
      return {
        spend: Number(row.costInLocalCurrency ?? 0),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        leads: Number(row.oneClickLeads ?? 0),
      };
    } catch (err) {
      logger.error({ err: String(err) }, "خطأ في تحليلات لينكدإن");
      return null;
    }
  },

  async pause(externalId: string): Promise<ActionResult> {
    if (env.dryRun || !this.isConfigured()) return { ok: true, simulated: true };
    try {
      const res = await fetch(`https://api.linkedin.com/rest/adCampaigns/${externalId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.linkedin.accessToken}`,
          "Content-Type": "application/json",
          "LinkedIn-Version": "202506",
          "X-Restli-Protocol-Version": "2.0.0",
          "X-RestLi-Method": "PARTIAL_UPDATE",
        },
        body: JSON.stringify({ patch: { $set: { status: "PAUSED" } } }),
      });
      return res.ok ? { ok: true } : { ok: false, error: `لينكدإن ${res.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async setDailyBudget(externalId: string, amount: number): Promise<ActionResult> {
    if (env.dryRun || !this.isConfigured()) return { ok: true, simulated: true };
    try {
      const res = await fetch(`https://api.linkedin.com/rest/adCampaigns/${externalId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.linkedin.accessToken}`,
          "Content-Type": "application/json",
          "LinkedIn-Version": "202506",
          "X-Restli-Protocol-Version": "2.0.0",
          "X-RestLi-Method": "PARTIAL_UPDATE",
        },
        body: JSON.stringify({
          patch: { $set: { dailyBudget: { amount: amount.toFixed(2), currencyCode: "SAR" } } },
        }),
      });
      return res.ok ? { ok: true } : { ok: false, error: `لينكدإن ${res.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
