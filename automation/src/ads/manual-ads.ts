import { logger } from "../logger.js";
import { notifyApprovers } from "../messaging/whatsapp.js";
import type { ActionResult } from "../types.js";
import type { AdPlatform, AdsAdapter, CampaignSpec, Insights } from "./types.js";

const LABEL: Record<string, string> = { tiktok: "تيك توك", snapchat: "سناب شات" };

/**
 * منصات تُدار حملاتها من لوحاتها، ويتولى النظام التخطيط والتنبيه والقياس
 * اعتمادًا على أرقام تُدخَل عبر الأمر: `قياس <المنصة> <المعرّف> <إنفاق> <ظهور> <نقرات> <عملاء>`
 */
function manualAds(platform: AdPlatform): AdsAdapter {
  return {
    platform,
    isConfigured: () => true,

    async createCampaign(spec: CampaignSpec): Promise<ActionResult> {
      const brief = [
        `🧾 *حملة ${LABEL[platform] ?? platform} للإنشاء اليدوي*`,
        `الاسم: ${spec.name}`,
        `الهدف: ${spec.objective}`,
        `الميزانية اليومية: ${spec.dailyBudget.toFixed(0)} ريال`,
        "",
        `الاستهداف: ${spec.targetingBrief}`,
        "",
        `بعد إنشائها أرسل: ربط ${platform} <المعرّف> ${spec.name}`,
      ].join("\n");
      await notifyApprovers(brief);
      logger.info({ platform, name: spec.name }, "أُرسل ملخص الحملة للإنشاء اليدوي");
      return { ok: true, simulated: true };
    },

    async fetchInsights(): Promise<Insights | null> {
      return null; // تُدخَل الأرقام يدويًا عبر أمر القياس
    },

    async pause(externalId: string): Promise<ActionResult> {
      await notifyApprovers(`⛔ *أوقف الإعلان يدويًا*\nالمنصة: ${LABEL[platform] ?? platform}\nالمعرّف: ${externalId}`);
      return { ok: true, simulated: true };
    },

    async setDailyBudget(externalId: string, amount: number): Promise<ActionResult> {
      await notifyApprovers(
        `💰 *عدّل الميزانية يدويًا*\nالمنصة: ${LABEL[platform] ?? platform}\nالمعرّف: ${externalId}\nالميزانية اليومية الجديدة: ${amount.toFixed(0)} ريال`
      );
      return { ok: true, simulated: true };
    },
  };
}

export const tiktokAds = manualAds("tiktok");
export const snapchatAds = manualAds("snapchat");
