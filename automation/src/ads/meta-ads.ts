import { env } from "../config.js";
import { logger } from "../logger.js";
import { GRAPH_VERSION } from "../channels/types.js";
import type { ActionResult } from "../types.js";
import type { AdsAdapter, CampaignSpec, Insights } from "./types.js";

const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function accountPath(): string {
  const id = env.meta.adAccountId;
  return id.startsWith("act_") ? id : `act_${id}`;
}

async function graph<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: Record<string, unknown> }
): Promise<{ ok: boolean; data: T; error?: string }> {
  const url = new URL(`${BASE}/${path}`);
  const options: RequestInit = { method: init.method };

  if (init.method === "GET") {
    url.searchParams.set("access_token", env.meta.accessToken);
    for (const [k, v] of Object.entries(init.body ?? {})) url.searchParams.set(k, String(v));
  } else {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify({ ...(init.body ?? {}), access_token: env.meta.accessToken });
  }

  const res = await fetch(url, options);
  const data = (await res.json()) as T & { error?: { message?: string } };
  return { ok: res.ok, data, error: data.error?.message };
}

export const metaAds: AdsAdapter = {
  platform: "meta",

  isConfigured(): boolean {
    return Boolean(env.meta.accessToken && env.meta.adAccountId);
  },

  async createCampaign(spec: CampaignSpec): Promise<ActionResult> {
    if (env.dryRun || !this.isConfigured()) {
      logger.info({ name: spec.name }, "[محاكاة] إنشاء حملة ميتا");
      return { ok: true, simulated: true, externalId: `sim-meta-${Date.now()}` };
    }
    try {
      const created = await graph<{ id?: string }>(`${accountPath()}/campaigns`, {
        method: "POST",
        body: {
          name: spec.name,
          objective: "OUTCOME_LEADS",
          status: "PAUSED", // تبدأ متوقفة — لا إنفاق قبل مراجعة بشرية
          special_ad_categories: JSON.stringify(["HOUSING"]),
          buying_type: "AUCTION",
        },
      });
      if (!created.ok || !created.data.id) {
        return { ok: false, error: created.error ?? "فشل إنشاء حملة ميتا" };
      }
      return { ok: true, externalId: created.data.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async fetchInsights(externalId: string, sinceYmd: string, untilYmd: string): Promise<Insights | null> {
    if (env.dryRun || !this.isConfigured()) return null;
    try {
      const res = await graph<{ data?: Record<string, unknown>[] }>(`${externalId}/insights`, {
        method: "GET",
        body: {
          fields: "spend,impressions,clicks,actions",
          time_range: JSON.stringify({ since: sinceYmd, until: untilYmd }),
        },
      });
      const row = res.data.data?.[0];
      if (!row) return { spend: 0, impressions: 0, clicks: 0, leads: 0 };

      const actions = (row.actions as { action_type: string; value: string }[] | undefined) ?? [];
      const leads = actions
        .filter((a) => a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped")
        .reduce((sum, a) => sum + Number(a.value ?? 0), 0);

      return {
        spend: Number(row.spend ?? 0),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        leads,
      };
    } catch (err) {
      logger.error({ err: String(err), externalId }, "فشل جلب بيانات ميتا");
      return null;
    }
  },

  async pause(externalId: string): Promise<ActionResult> {
    if (env.dryRun || !this.isConfigured()) return { ok: true, simulated: true };
    const res = await graph<{ success?: boolean }>(externalId, { method: "POST", body: { status: "PAUSED" } });
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  },

  async setDailyBudget(externalId: string, amount: number): Promise<ActionResult> {
    if (env.dryRun || !this.isConfigured()) return { ok: true, simulated: true };
    // ميتا تستقبل الميزانية بأصغر وحدة نقدية (هللة)
    const res = await graph<{ success?: boolean }>(externalId, {
      method: "POST",
      body: { daily_budget: Math.round(amount * 100) },
    });
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  },
};
