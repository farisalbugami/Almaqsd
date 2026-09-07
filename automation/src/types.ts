import type { ChannelId } from "./config.js";

export type PostStatus =
  | "planned"
  | "generated"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "revise"
  | "published"
  | "failed"
  | "expired";

export interface Post {
  id: number;
  channel: ChannelId;
  scheduled_at: string;
  week: number;
  theme: string;
  topic: string;
  audience_id: string;
  content_type: "educational" | "proof" | "promotional";
  status: PostStatus;
  hook: string | null;
  body: string | null;
  cta: string | null;
  hashtags: string | null;
  media_brief: string | null;
  approval_code: string | null;
  revision_note: string | null;
  generated_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  published_at: string | null;
  external_id: string | null;
  error: string | null;
  created_at: string;
}

export type LeadStatus = "new" | "contacted" | "qualified" | "meeting" | "won" | "lost";

export interface Lead {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  track: "owners" | "partners";
  property_type: string | null;
  units: string | null;
  city: string | null;
  notes: string | null;
  score: number;
  status: LeadStatus;
  ad_campaign_id: number | null;
  created_at: string;
  first_response_at: string | null;
  updated_at: string;
}

export interface AdCampaign {
  id: number;
  platform: "meta" | "linkedin" | "tiktok" | "snapchat";
  external_id: string | null;
  name: string;
  audience_id: string;
  objective: string;
  daily_budget: number;
  status: "draft" | "active" | "paused" | "stopped";
  created_at: string;
  last_budget_change_at: string | null;
}

export interface AdMetricRow {
  ad_campaign_id: number;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
}

/** نتيجة موحّدة لأي عملية خارجية (نشر، إعلان، رسالة) */
export interface ActionResult {
  ok: boolean;
  /** simulated = تمت المحاكاة لعدم توفر المفاتيح أو لوضع DRY_RUN */
  simulated?: boolean;
  externalId?: string;
  error?: string;
}
