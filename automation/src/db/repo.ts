import { db } from "./index.js";
import type { AdCampaign, Lead, LeadStatus, Post, PostStatus } from "../types.js";
import type { ChannelId } from "../config.js";

/* ───────────────────────────── المنشورات ───────────────────────────── */

export const posts = {
  insertPlanned(p: {
    channel: ChannelId;
    scheduled_at: string;
    week: number;
    theme: string;
    topic: string;
    audience_id: string;
    content_type: Post["content_type"];
  }): number | null {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO posts (channel, scheduled_at, week, theme, topic, audience_id, content_type, status)
      VALUES (@channel, @scheduled_at, @week, @theme, @topic, @audience_id, @content_type, 'planned')`);
    const info = stmt.run(p);
    return info.changes > 0 ? Number(info.lastInsertRowid) : null;
  },

  byId(id: number): Post | undefined {
    return db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as Post | undefined;
  },

  byApprovalCode(code: string): Post | undefined {
    return db
      .prepare("SELECT * FROM posts WHERE approval_code = ? AND status IN ('pending_approval','revise')")
      .get(code.toUpperCase()) as Post | undefined;
  },

  /** منشورات مخطّطة يحين وقت توليدها (قبل النشر بعدد أيام) */
  dueForGeneration(withinDays: number, limit = 25): Post[] {
    return db
      .prepare(
        `SELECT * FROM posts
         WHERE status IN ('planned','revise')
           AND datetime(scheduled_at) <= datetime('now', ?)
           AND datetime(scheduled_at) >= datetime('now', '-1 day')
         ORDER BY scheduled_at ASC LIMIT ?`
      )
      .all(`+${withinDays} day`, limit) as Post[];
  },

  /** منشورات مولّدة تنتظر إرسال طلب موافقة */
  awaitingApprovalRequest(limit = 20): Post[] {
    return db
      .prepare("SELECT * FROM posts WHERE status = 'generated' ORDER BY scheduled_at ASC LIMIT ?")
      .all(limit) as Post[];
  },

  /** منشورات معتمدة حان وقت نشرها */
  dueForPublish(limit = 20): Post[] {
    return db
      .prepare(
        `SELECT * FROM posts
         WHERE status = 'approved' AND datetime(scheduled_at) <= datetime('now')
         ORDER BY scheduled_at ASC LIMIT ?`
      )
      .all(limit) as Post[];
  },

  pendingApproval(): Post[] {
    return db
      .prepare("SELECT * FROM posts WHERE status = 'pending_approval' ORDER BY scheduled_at ASC")
      .all() as Post[];
  },

  saveGenerated(
    id: number,
    c: { hook: string; body: string; cta: string; hashtags: string; media_brief: string },
    approvalCode: string
  ): void {
    db.prepare(
      `UPDATE posts SET hook=@hook, body=@body, cta=@cta, hashtags=@hashtags, media_brief=@media_brief,
       approval_code=@code, status='generated', generated_at=datetime('now'), revision_note=NULL, error=NULL
       WHERE id=@id`
    ).run({ ...c, code: approvalCode, id });
  },

  setStatus(id: number, status: PostStatus, extra: Partial<Post> = {}): void {
    const fields: string[] = ["status = @status"];
    const params: Record<string, unknown> = { id, status };
    for (const [k, v] of Object.entries(extra)) {
      fields.push(`${k} = @${k}`);
      params[k] = v;
    }
    db.prepare(`UPDATE posts SET ${fields.join(", ")} WHERE id = @id`).run(params);
  },

  markApproved(id: number, by: string): void {
    db.prepare("UPDATE posts SET status='approved', approved_by=?, approved_at=datetime('now') WHERE id=?").run(by, id);
  },

  markPublished(id: number, externalId: string | undefined): void {
    db.prepare("UPDATE posts SET status='published', published_at=datetime('now'), external_id=? WHERE id=?").run(
      externalId ?? null,
      id
    );
  },

  expireStale(hours: number): number {
    const info = db
      .prepare(
        `UPDATE posts SET status='expired'
         WHERE status IN ('generated','pending_approval')
           AND datetime(generated_at, '+' || ? || ' hours') < datetime('now')`
      )
      .run(hours);
    return info.changes;
  },

  countsByStatus(): Record<string, number> {
    const rows = db.prepare("SELECT status, COUNT(*) n FROM posts GROUP BY status").all() as {
      status: string;
      n: number;
    }[];
    return Object.fromEntries(rows.map((r) => [r.status, r.n]));
  },

  publishedSince(sinceIso: string): Post[] {
    return db
      .prepare("SELECT * FROM posts WHERE status='published' AND published_at >= ? ORDER BY published_at DESC")
      .all(sinceIso) as Post[];
  },
};

/* ───────────────────────── العملاء المحتملون ───────────────────────── */

export const leads = {
  insert(l: Omit<Lead, "id" | "created_at" | "updated_at" | "first_response_at" | "status" | "score"> & {
    score: number;
    status?: LeadStatus;
  }): number | null {
    const info = db
      .prepare(
        `INSERT OR IGNORE INTO leads (name, phone, email, source, track, property_type, units, city, notes, score, status, ad_campaign_id)
         VALUES (@name, @phone, @email, @source, @track, @property_type, @units, @city, @notes, @score, @status, @ad_campaign_id)`
      )
      .run({ ...l, status: l.status ?? "new" });
    return info.changes > 0 ? Number(info.lastInsertRowid) : null;
  },

  byId(id: number): Lead | undefined {
    return db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as Lead | undefined;
  },

  byPhone(phone: string): Lead | undefined {
    return db.prepare("SELECT * FROM leads WHERE phone = ? ORDER BY created_at DESC LIMIT 1").get(phone) as
      | Lead
      | undefined;
  },

  setStatus(id: number, status: LeadStatus): void {
    db.prepare("UPDATE leads SET status=?, updated_at=datetime('now') WHERE id=?").run(status, id);
  },

  markFirstResponse(id: number): void {
    db.prepare(
      "UPDATE leads SET first_response_at=COALESCE(first_response_at, datetime('now')), updated_at=datetime('now') WHERE id=?"
    ).run(id);
  },

  /** عملاء تجاوزوا مهلة الرد الأول ولم يُرد عليهم */
  breachingSla(minutes: number): Lead[] {
    return db
      .prepare(
        `SELECT * FROM leads
         WHERE first_response_at IS NULL
           AND datetime(created_at, '+' || ? || ' minutes') < datetime('now')
           AND status = 'new'`
      )
      .all(minutes) as Lead[];
  },

  since(sinceIso: string): Lead[] {
    return db.prepare("SELECT * FROM leads WHERE created_at >= ? ORDER BY created_at DESC").all(sinceIso) as Lead[];
  },

  countsByStatus(): Record<string, number> {
    const rows = db.prepare("SELECT status, COUNT(*) n FROM leads GROUP BY status").all() as {
      status: string;
      n: number;
    }[];
    return Object.fromEntries(rows.map((r) => [r.status, r.n]));
  },

  addEvent(leadId: number, type: string, payload?: unknown): void {
    db.prepare("INSERT INTO lead_events (lead_id, type, payload) VALUES (?,?,?)").run(
      leadId,
      type,
      payload === undefined ? null : JSON.stringify(payload)
    );
  },
};

/* ─────────────────────────── مسارات المتابعة ─────────────────────────── */

export const sequences = {
  start(leadId: number, sequenceId: string, firstRunAtIso: string): void {
    db.prepare(
      `INSERT OR IGNORE INTO sequence_runs (lead_id, sequence_id, step_index, next_run_at, status)
       VALUES (?, ?, 0, ?, 'active')`
    ).run(leadId, sequenceId, firstRunAtIso);
  },

  due(limit = 50): { id: number; lead_id: number; sequence_id: string; step_index: number }[] {
    return db
      .prepare(
        `SELECT id, lead_id, sequence_id, step_index FROM sequence_runs
         WHERE status='active' AND datetime(next_run_at) <= datetime('now')
         ORDER BY next_run_at ASC LIMIT ?`
      )
      .all(limit) as { id: number; lead_id: number; sequence_id: string; step_index: number }[];
  },

  advance(id: number, nextIndex: number, nextRunAtIso: string): void {
    db.prepare("UPDATE sequence_runs SET step_index=?, next_run_at=? WHERE id=?").run(nextIndex, nextRunAtIso, id);
  },

  finish(id: number, status: "done" | "stopped" = "done"): void {
    db.prepare("UPDATE sequence_runs SET status=? WHERE id=?").run(status, id);
  },

  stopForLead(leadId: number): void {
    db.prepare("UPDATE sequence_runs SET status='stopped' WHERE lead_id=? AND status='active'").run(leadId);
  },
};

/* ───────────────────────── الحملات الإعلانية ───────────────────────── */

export const ads = {
  upsert(c: Omit<AdCampaign, "id" | "created_at" | "last_budget_change_at">): number {
    db.prepare(
      `INSERT INTO ad_campaigns (platform, external_id, name, audience_id, objective, daily_budget, status)
       VALUES (@platform, @external_id, @name, @audience_id, @objective, @daily_budget, @status)
       ON CONFLICT(platform, name) DO UPDATE SET
         external_id=excluded.external_id, daily_budget=excluded.daily_budget, status=excluded.status`
    ).run(c);
    const row = db.prepare("SELECT id FROM ad_campaigns WHERE platform=? AND name=?").get(c.platform, c.name) as {
      id: number;
    };
    return row.id;
  },

  all(): AdCampaign[] {
    return db.prepare("SELECT * FROM ad_campaigns ORDER BY platform, name").all() as AdCampaign[];
  },

  active(): AdCampaign[] {
    return db.prepare("SELECT * FROM ad_campaigns WHERE status='active'").all() as AdCampaign[];
  },

  byId(id: number): AdCampaign | undefined {
    return db.prepare("SELECT * FROM ad_campaigns WHERE id=?").get(id) as AdCampaign | undefined;
  },

  setStatus(id: number, status: AdCampaign["status"]): void {
    db.prepare("UPDATE ad_campaigns SET status=? WHERE id=?").run(status, id);
  },

  setBudget(id: number, budget: number): void {
    db.prepare("UPDATE ad_campaigns SET daily_budget=?, last_budget_change_at=datetime('now') WHERE id=?").run(
      budget,
      id
    );
  },

  recordMetrics(m: { ad_campaign_id: number; date: string; spend: number; impressions: number; clicks: number; leads: number }): void {
    db.prepare(
      `INSERT INTO ad_metrics (ad_campaign_id, date, spend, impressions, clicks, leads)
       VALUES (@ad_campaign_id, @date, @spend, @impressions, @clicks, @leads)
       ON CONFLICT(ad_campaign_id, date) DO UPDATE SET
         spend=excluded.spend, impressions=excluded.impressions, clicks=excluded.clicks, leads=excluded.leads`
    ).run(m);
  },

  /** إجماليات إعلان منذ إنشائه */
  totals(adCampaignId: number): { spend: number; clicks: number; impressions: number; leads: number; days: number } {
    const r = db
      .prepare(
        `SELECT COALESCE(SUM(spend),0) spend, COALESCE(SUM(clicks),0) clicks,
                COALESCE(SUM(impressions),0) impressions, COALESCE(SUM(leads),0) leads,
                COUNT(*) days
         FROM ad_metrics WHERE ad_campaign_id = ?`
      )
      .get(adCampaignId) as { spend: number; clicks: number; impressions: number; leads: number; days: number };
    return r;
  },

  /** متوسط تكلفة العميل المحتمل لكل منصة */
  platformCpl(): Record<string, number> {
    const rows = db
      .prepare(
        `SELECT c.platform, COALESCE(SUM(m.spend),0) spend, COALESCE(SUM(m.leads),0) leads
         FROM ad_campaigns c LEFT JOIN ad_metrics m ON m.ad_campaign_id = c.id
         GROUP BY c.platform`
      )
      .all() as { platform: string; spend: number; leads: number }[];
    const out: Record<string, number> = {};
    for (const r of rows) out[r.platform] = r.leads > 0 ? r.spend / r.leads : Infinity;
    return out;
  },

  metricsSince(sinceDate: string): { platform: string; spend: number; clicks: number; impressions: number; leads: number }[] {
    return db
      .prepare(
        `SELECT c.platform, COALESCE(SUM(m.spend),0) spend, COALESCE(SUM(m.clicks),0) clicks,
                COALESCE(SUM(m.impressions),0) impressions, COALESCE(SUM(m.leads),0) leads
         FROM ad_campaigns c LEFT JOIN ad_metrics m ON m.ad_campaign_id = c.id AND m.date >= ?
         GROUP BY c.platform`
      )
      .all(sinceDate) as { platform: string; spend: number; clicks: number; impressions: number; leads: number }[];
  },

  logAction(adCampaignId: number | null, action: string, reason: string): void {
    db.prepare("INSERT INTO optimizer_actions (ad_campaign_id, action, reason) VALUES (?,?,?)").run(
      adCampaignId,
      action,
      reason
    );
  },

  actionsSince(sinceIso: string): { action: string; reason: string; created_at: string }[] {
    return db
      .prepare("SELECT action, reason, created_at FROM optimizer_actions WHERE created_at >= ? ORDER BY created_at DESC")
      .all(sinceIso) as { action: string; reason: string; created_at: string }[];
  },
};

/* ───────────────────────── سجل الرسائل والموافقات ───────────────────────── */

export const outbox = {
  log(channel: string, recipient: string, body: string, status: string, subject?: string, error?: string): void {
    db.prepare(
      "INSERT INTO messages_out (channel, recipient, subject, body, status, error) VALUES (?,?,?,?,?,?)"
    ).run(channel, recipient, subject ?? null, body, status, error ?? null);
  },
};

export const approvals = {
  record(sentTo: string, postIds: number[]): number {
    const info = db
      .prepare("INSERT INTO approval_requests (sent_to, post_ids) VALUES (?,?)")
      .run(sentTo, JSON.stringify(postIds));
    return Number(info.lastInsertRowid);
  },
};
