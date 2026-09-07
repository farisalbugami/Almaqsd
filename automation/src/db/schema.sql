PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- منشورات المحتوى المولّدة والمجدولة
CREATE TABLE IF NOT EXISTS posts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  channel         TEXT NOT NULL,
  scheduled_at    TEXT NOT NULL,              -- ISO
  week            INTEGER NOT NULL,
  theme           TEXT NOT NULL,
  topic           TEXT NOT NULL,
  audience_id     TEXT NOT NULL,
  content_type    TEXT NOT NULL,              -- educational | proof | promotional
  status          TEXT NOT NULL DEFAULT 'planned',
  hook            TEXT,
  body            TEXT,
  cta             TEXT,
  hashtags        TEXT,
  media_brief     TEXT,
  approval_code   TEXT,
  revision_note   TEXT,
  generated_at    TEXT,
  approved_by     TEXT,
  approved_at     TEXT,
  published_at    TEXT,
  external_id     TEXT,
  error           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_status   ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_sched    ON posts(scheduled_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_slot ON posts(channel, scheduled_at);

-- طلبات الموافقة المرسلة عبر واتساب
CREATE TABLE IF NOT EXISTS approval_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sent_to     TEXT NOT NULL,
  post_ids    TEXT NOT NULL,                  -- JSON array
  sent_at     TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT
);

-- العملاء المحتملون
CREATE TABLE IF NOT EXISTS leads (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,
  phone             TEXT NOT NULL,
  email             TEXT,
  source            TEXT NOT NULL,            -- landing | linkedin | instagram | ...
  track             TEXT NOT NULL DEFAULT 'owners',
  property_type     TEXT,
  units             TEXT,
  city              TEXT,
  notes             TEXT,
  score             INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'new',  -- new|contacted|qualified|meeting|won|lost
  ad_campaign_id    INTEGER,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  first_response_at TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(phone, source)
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

CREATE TABLE IF NOT EXISTS lead_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  payload    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- تشغيل مسارات المتابعة (واتساب/بريد)
CREATE TABLE IF NOT EXISTS sequence_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sequence_id TEXT NOT NULL,
  step_index  INTEGER NOT NULL DEFAULT 0,
  next_run_at TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',   -- active|done|stopped
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(lead_id, sequence_id)
);
CREATE INDEX IF NOT EXISTS idx_seq_due ON sequence_runs(status, next_run_at);

-- الحملات الإعلانية المدفوعة
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  platform               TEXT NOT NULL,        -- meta | linkedin | tiktok | snapchat
  external_id            TEXT,
  name                   TEXT NOT NULL,
  audience_id            TEXT NOT NULL,
  objective              TEXT NOT NULL,
  daily_budget           REAL NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'draft',  -- draft|active|paused|stopped
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  last_budget_change_at  TEXT,
  UNIQUE(platform, name)
);

CREATE TABLE IF NOT EXISTS ad_metrics (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ad_campaign_id INTEGER NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  date           TEXT NOT NULL,
  spend          REAL NOT NULL DEFAULT 0,
  impressions    INTEGER NOT NULL DEFAULT 0,
  clicks         INTEGER NOT NULL DEFAULT 0,
  leads          INTEGER NOT NULL DEFAULT 0,
  UNIQUE(ad_campaign_id, date)
);

CREATE TABLE IF NOT EXISTS optimizer_actions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ad_campaign_id INTEGER REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  action         TEXT NOT NULL,
  reason         TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- سجل الرسائل الصادرة (واتساب/بريد)
CREATE TABLE IF NOT EXISTS messages_out (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  channel    TEXT NOT NULL,
  recipient  TEXT NOT NULL,
  subject    TEXT,
  body       TEXT NOT NULL,
  status     TEXT NOT NULL,
  error      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
