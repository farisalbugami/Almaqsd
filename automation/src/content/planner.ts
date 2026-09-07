import { campaign, plan, type ChannelId } from "../config.js";
import { kvGet, kvSet } from "../db/index.js";
import { posts } from "../db/repo.js";
import { logger } from "../logger.js";
import { addDays, riyadhToUtcIso, startOfSaudiWeek, ymd } from "../time.js";

const CHANNEL_IDS: ChannelId[] = ["linkedin", "instagram", "tiktok", "snapchat"];
const SHORT_FORM: ChannelId[] = ["tiktok", "snapchat"];

/** يوزّع أنواع المحتوى وفق النسب المعلنة في plan.yaml */
function contentTypeFor(index: number): "educational" | "proof" | "promotional" {
  const { educational, proof } = plan.mix;
  const pos = (index % 20) / 20; // نافذة من 20 منشورًا
  if (pos < educational) return "educational";
  if (pos < educational + proof) return "proof";
  return "promotional";
}

function pick<T>(arr: T[], i: number, fallback: T): T {
  if (arr.length === 0) return fallback;
  return arr[i % arr.length] ?? fallback;
}

export interface SeedResult {
  created: number;
  skipped: number;
  startDate: string;
}

/**
 * يبني جدول المنشورات لكامل الخطة (12 أسبوعًا).
 * آمن للتكرار: الفهرس الفريد (channel, scheduled_at) يمنع التكرار.
 */
export function seedPlan(startDateInput?: string): SeedResult {
  const start = startOfSaudiWeek(startDateInput ? new Date(`${startDateInput}T00:00:00Z`) : new Date());
  const startYmd = ymd(start);
  kvSet("campaign_start", startYmd);

  let created = 0;
  let skipped = 0;
  let globalIndex = 0;

  for (const wk of plan.weeks) {
    const weekStart = addDays(start, (wk.week - 1) * 7);

    for (const channel of CHANNEL_IDS) {
      const cfg = campaign.channels[channel];
      if (!cfg?.enabled) continue;

      const topicPool = SHORT_FORM.includes(channel) ? [...wk.topics, ...plan.shortFormBank] : wk.topics;

      cfg.postDays.slice(0, cfg.postsPerWeek).forEach((dayOfWeek, i) => {
        const date = addDays(weekStart, dayOfWeek);
        const scheduledAt = riyadhToUtcIso(ymd(date), cfg.postTime);
        const audienceId = pick(wk.audiences, i, "A1");
        const topic = pick(topicPool, globalIndex, wk.theme);

        const id = posts.insertPlanned({
          channel,
          scheduled_at: scheduledAt,
          week: wk.week,
          theme: wk.theme,
          topic,
          audience_id: audienceId,
          content_type: contentTypeFor(globalIndex),
        });
        if (id) created++;
        else skipped++;
        globalIndex++;
      });
    }
  }

  logger.info({ created, skipped, startDate: startYmd }, "تم بناء جدول المحتوى");
  return { created, skipped, startDate: startYmd };
}

export function campaignStartDate(): string | null {
  return kvGet("campaign_start");
}
