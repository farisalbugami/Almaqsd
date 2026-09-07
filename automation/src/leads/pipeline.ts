import { campaign } from "../config.js";
import { logger } from "../logger.js";
import { leads, sequences as seqRepo } from "../db/repo.js";
import { sendEmail } from "../messaging/email.js";
import { SEQUENCES, sequenceForTrack } from "../messaging/sequences.js";
import { notifyApprovers, sendWhatsapp } from "../messaging/whatsapp.js";
import type { Lead } from "../types.js";
import { scoreLead } from "./scoring.js";

export interface LeadInput {
  name: string;
  phone: string;
  email?: string | null;
  source: string;
  propertyType?: string | null;
  units?: string | null;
  city?: string | null;
  notes?: string | null;
  track?: "owners" | "partners";
  adCampaignId?: number | null;
}

const PARTNER_TYPES = ["أرض أو مشروع تحت التطوير", "عقار فندقي / ضيافة"];

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("0")) return `966${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) return `966${digits}`;
  return digits;
}

export interface IntakeResult {
  created: boolean;
  leadId: number | null;
  score: number;
  qualified: boolean;
  hot: boolean;
}

/** نقطة الدخول الوحيدة لأي عميل محتمل مهما كان مصدره */
export async function intakeLead(input: LeadInput): Promise<IntakeResult> {
  const phone = normalizePhone(input.phone);
  const track = input.track ?? (PARTNER_TYPES.includes(input.propertyType ?? "") ? "partners" : "owners");
  const scored = scoreLead({
    source: input.source,
    propertyType: input.propertyType,
    units: input.units,
    email: input.email,
    notes: input.notes,
  });

  const leadId = leads.insert({
    name: input.name.trim() || "غير مذكور",
    phone,
    email: input.email ?? null,
    source: input.source,
    track,
    property_type: input.propertyType ?? null,
    units: input.units ?? null,
    city: input.city ?? null,
    notes: input.notes ?? null,
    score: scored.score,
    ad_campaign_id: input.adCampaignId ?? null,
  });

  if (!leadId) {
    const existing = leads.byPhone(phone);
    logger.info({ phone }, "عميل محتمل مكرر — تم تجاهله");
    if (existing) leads.addEvent(existing.id, "duplicate_submission", { source: input.source });
    return { created: false, leadId: existing?.id ?? null, score: scored.score, qualified: scored.qualified, hot: scored.hot };
  }

  leads.addEvent(leadId, "created", { source: input.source, score: scored.score, reasons: scored.reasons });

  const sequence = sequenceForTrack(track);
  seqRepo.start(leadId, sequence.id, new Date().toISOString());

  await alertSales(leadId, scored);
  logger.info({ leadId, score: scored.score, track }, "عميل محتمل جديد");

  return { created: true, leadId, score: scored.score, qualified: scored.qualified, hot: scored.hot };
}

async function alertSales(leadId: number, scored: { score: number; qualified: boolean; hot: boolean }): Promise<void> {
  const lead = leads.byId(leadId);
  if (!lead) return;
  const badge = scored.hot ? "🔥 عميل ساخن" : scored.qualified ? "✅ عميل مؤهل" : "🔔 عميل جديد";
  const body = [
    `${badge} — ${scored.score} نقطة`,
    "",
    `👤 ${lead.name}`,
    `📱 ${lead.phone}`,
    lead.email ? `✉️ ${lead.email}` : "",
    `🏢 ${lead.property_type ?? "—"} · ${lead.units ?? "—"} وحدة`,
    `📍 ${lead.city ?? "—"}`,
    `🔗 المصدر: ${lead.source}`,
    "",
    `⏱️ مهلة الرد الأول: ${campaign.sla.firstResponseMinutes} دقيقة`,
  ]
    .filter(Boolean)
    .join("\n");
  await notifyApprovers(body);
}

/** ينفّذ خطوات المتابعة المستحقة (يستدعيه المجدول كل ١٥ دقيقة) */
export async function runDueSequenceSteps(): Promise<{ executed: number }> {
  const due = seqRepo.due(50);
  let executed = 0;

  for (const run of due) {
    const lead = leads.byId(run.lead_id);
    const sequence = SEQUENCES[run.sequence_id];
    if (!lead || !sequence) {
      seqRepo.finish(run.id, "stopped");
      continue;
    }
    if (["won", "lost"].includes(lead.status)) {
      seqRepo.finish(run.id, "stopped");
      continue;
    }

    const step = sequence.steps[run.step_index];
    if (!step) {
      seqRepo.finish(run.id, "done");
      continue;
    }

    const body = step.render(lead);
    const result =
      step.channel === "whatsapp"
        ? await sendWhatsapp(lead.phone, body)
        : await sendEmail(lead.email ?? "", step.subject ?? "رسالة من المقصد", body);

    leads.addEvent(lead.id, `sequence_step_${step.channel}`, {
      sequence: sequence.id,
      step: run.step_index,
      ok: result.ok,
      error: result.error,
    });

    if (run.step_index === 0) {
      leads.markFirstResponse(lead.id);
      if (lead.status === "new") leads.setStatus(lead.id, "contacted");
    }

    const nextIndex = run.step_index + 1;
    const nextStep = sequence.steps[nextIndex];
    if (!nextStep) {
      seqRepo.finish(run.id, "done");
    } else {
      const base = new Date(lead.created_at.replace(" ", "T") + "Z").getTime();
      const nextAt = new Date(base + nextStep.delayHours * 3600_000).toISOString();
      seqRepo.advance(run.id, nextIndex, nextAt);
    }
    executed++;
  }

  if (executed) logger.info({ executed }, "نُفّذت خطوات متابعة");
  return { executed };
}

/** ينبّه عند تجاوز مهلة الرد الأول */
export async function checkSlaBreaches(): Promise<number> {
  const breaching = leads.breachingSla(campaign.sla.firstResponseMinutes);
  for (const lead of breaching) {
    await notifyApprovers(
      `⚠️ *تجاوز مهلة الرد*\n${lead.name} — ${lead.phone}\nوصل قبل أكثر من ${campaign.sla.firstResponseMinutes} دقيقة ولم يُرد عليه بعد.`
    );
    leads.addEvent(lead.id, "sla_breach");
  }
  return breaching.length;
}

export function markLeadStatus(leadId: number, status: Lead["status"]): void {
  leads.setStatus(leadId, status);
  if (status === "won" || status === "lost") seqRepo.stopForLead(leadId);
  leads.addEvent(leadId, `status_${status}`);
}
