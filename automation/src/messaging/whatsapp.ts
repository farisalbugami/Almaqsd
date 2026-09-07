import { env } from "../config.js";
import { logger } from "../logger.js";
import { outbox } from "../db/repo.js";
import type { ActionResult } from "../types.js";
import { GRAPH_VERSION } from "../channels/types.js";

export function isWhatsappConfigured(): boolean {
  return Boolean(env.whatsapp.accessToken && env.whatsapp.phoneNumberId);
}

/** إرسال رسالة نصية عبر WhatsApp Cloud API */
export async function sendWhatsapp(to: string, body: string): Promise<ActionResult> {
  const recipient = to.replace(/[^\d]/g, "");
  if (!recipient) return { ok: false, error: "رقم غير صالح" };

  if (env.dryRun || !isWhatsappConfigured()) {
    logger.info({ to: recipient, preview: body.slice(0, 80) }, "[محاكاة] رسالة واتساب");
    outbox.log("whatsapp", recipient, body, "simulated");
    return { ok: true, simulated: true };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${env.whatsapp.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsapp.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: { preview_url: false, body },
      }),
    });

    const data = (await res.json()) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) {
      const error = data.error?.message ?? `HTTP ${res.status}`;
      outbox.log("whatsapp", recipient, body, "failed", undefined, error);
      return { ok: false, error };
    }
    outbox.log("whatsapp", recipient, body, "sent");
    return { ok: true, externalId: data.messages?.[0]?.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    outbox.log("whatsapp", recipient, body, "failed", undefined, error);
    return { ok: false, error };
  }
}

export async function notifyApprovers(body: string): Promise<void> {
  for (const number of env.whatsapp.approvers) {
    await sendWhatsapp(number, body);
  }
}
