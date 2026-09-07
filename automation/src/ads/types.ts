import type { ActionResult } from "../types.js";

export type AdPlatform = "meta" | "linkedin" | "tiktok" | "snapchat";

export interface CampaignSpec {
  name: string;
  audienceId: string;
  objective: string;
  dailyBudget: number;
  /** ملخص الاستهداف بالعربية — يُستخدم في الإنشاء اليدوي وفي التوثيق */
  targetingBrief: string;
}

export interface Insights {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
}

export interface AdsAdapter {
  platform: AdPlatform;
  isConfigured(): boolean;
  /** ينشئ الحملة برمجيًا حيثما أمكن، وإلا يعيد تعليمات إنشاء يدوي */
  createCampaign(spec: CampaignSpec): Promise<ActionResult>;
  fetchInsights(externalId: string, sinceYmd: string, untilYmd: string): Promise<Insights | null>;
  pause(externalId: string): Promise<ActionResult>;
  setDailyBudget(externalId: string, amount: number): Promise<ActionResult>;
}
