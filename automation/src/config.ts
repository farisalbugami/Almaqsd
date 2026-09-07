import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import "dotenv/config";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");

function readYaml<T>(file: string): T {
  const p = path.join(ROOT, "config", file);
  if (!fs.existsSync(p)) throw new Error(`ملف الإعدادات غير موجود: ${p}`);
  return YAML.parse(fs.readFileSync(p, "utf8")) as T;
}

/* ───────────────────────── أنواع الإعدادات ───────────────────────── */

export type ChannelId = "linkedin" | "instagram" | "tiktok" | "snapchat";
export type Track = "owners" | "partners";

export interface ChannelConfig {
  enabled: boolean;
  weight: number;
  postsPerWeek: number;
  postDays: number[];
  postTime: string;
  maxChars: number;
}

export interface Audience {
  id: string;
  /** أولوية الشريحة في الإنفاق الإعلاني — الأقل رقمًا أعلى أولوية */
  adPriority: number;
  name: string;
  track: Track;
  pain: string;
  message: string;
  channels: ChannelId[];
}

export interface CampaignConfig {
  company: {
    name: string;
    shortName: string;
    city: string;
    district: string;
    phones: string[];
    email: string;
    whatsapp: string;
    proofPoints: string[];
  };
  offers: Record<"primary" | "secondary", { id: string; name: string; promise: string; slaHours: number }>;
  audiences: Audience[];
  channels: Record<ChannelId, ChannelConfig>;
  budget: {
    currency: string;
    monthlyTotal: number;
    minDailyBudget: Record<string, number>;
    allocation: Record<string, number>;
  };
  optimizer: {
    spendNoLeadThreshold: number;
    cplMultiplierCap: number;
    minAgeDays: number;
    maxBudgetIncreasePct: number;
    budgetChangeCooldownDays: number;
    channelReviewDays: number;
    channelBudgetCutPct: number;
  };
  leadScoring: {
    qualifiedThreshold: number;
    hotThreshold: number;
    units: Record<string, number>;
    propertyType: Record<string, number>;
    sourceBonus: Record<string, number>;
  };
  approvals: {
    required: boolean;
    digestTime: string;
    expireHours: number;
    generateLeadDays: number;
  };
  reports: { dailyTime: string; weeklyDay: number; weeklyTime: string };
  sla: { firstResponseMinutes: number };
}

export interface PlanConfig {
  mix: { educational: number; proof: number; promotional: number };
  phases: { id: string; name: string; weeks: number[]; goal: string }[];
  weeks: { week: number; theme: string; audiences: string[]; topics: string[] }[];
  shortFormBank: string[];
}

/* ───────────────────────── متغيرات البيئة ───────────────────────── */

const bool = (v: string | undefined, dflt = false) =>
  v === undefined ? dflt : ["1", "true", "yes", "on"].includes(v.toLowerCase());

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  tz: process.env.TZ ?? "Asia/Riyadh",
  dryRun: bool(process.env.DRY_RUN, true),
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",

  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  contentModel: process.env.CONTENT_MODEL ?? "claude-opus-5",

  whatsapp: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "almaqsd-verify",
    approvers: (process.env.APPROVER_NUMBERS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    reportNumber: process.env.REPORT_NUMBER ?? "",
  },
  meta: {
    accessToken: process.env.META_ACCESS_TOKEN ?? "",
    appSecret: process.env.META_APP_SECRET ?? "",
    pageId: process.env.META_PAGE_ID ?? "",
    igUserId: process.env.META_IG_USER_ID ?? "",
    adAccountId: process.env.META_AD_ACCOUNT_ID ?? "",
    pixelId: process.env.META_PIXEL_ID ?? "",
  },
  linkedin: {
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN ?? "",
    orgUrn: process.env.LINKEDIN_ORG_URN ?? "",
    adAccountId: process.env.LINKEDIN_AD_ACCOUNT_ID ?? "",
  },
  tiktok: {
    accessToken: process.env.TIKTOK_ACCESS_TOKEN ?? "",
    businessId: process.env.TIKTOK_BUSINESS_ID ?? "",
    advertiserId: process.env.TIKTOK_ADVERTISER_ID ?? "",
  },
  snapchat: {
    accessToken: process.env.SNAPCHAT_ACCESS_TOKEN ?? "",
    adAccountId: process.env.SNAPCHAT_AD_ACCOUNT_ID ?? "",
    profileId: process.env.SNAPCHAT_PROFILE_ID ?? "",
  },
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.MAIL_FROM ?? "شركة المقصد <info@almaqsd.co>",
    reportEmail: process.env.REPORT_EMAIL ?? "",
  },
} as const;

export const campaign = readYaml<CampaignConfig>("campaign.yaml");
export const plan = readYaml<PlanConfig>("plan.yaml");

export function audienceById(id: string): Audience | undefined {
  return campaign.audiences.find((a) => a.id === id);
}
