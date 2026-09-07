import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config.js";
import { logger } from "../logger.js";
import { outbox } from "../db/repo.js";
import type { ActionResult } from "../types.js";

let transporter: Transporter | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(env.smtp.host && env.smtp.user);
}

function getTransporter(): Transporter | null {
  if (!isEmailConfigured()) return null;
  transporter ??= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
  return transporter;
}

export async function sendEmail(to: string, subject: string, body: string): Promise<ActionResult> {
  if (!to) return { ok: false, error: "لا يوجد عنوان بريد" };

  const tx = getTransporter();
  if (env.dryRun || !tx) {
    logger.info({ to, subject }, "[محاكاة] بريد إلكتروني");
    outbox.log("email", to, body, "simulated", subject);
    return { ok: true, simulated: true };
  }

  try {
    const info = await tx.sendMail({
      from: env.smtp.from,
      to,
      subject,
      text: body,
      html: `<div dir="rtl" style="font-family:Tajawal,Arial,sans-serif;font-size:15px;line-height:1.9;color:#3A3733">${body
        .split("\n")
        .map((line) => (line.trim() ? `<p style="margin:0 0 12px">${line}</p>` : "<br>"))
        .join("")}</div>`,
    });
    outbox.log("email", to, body, "sent", subject);
    return { ok: true, externalId: info.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    outbox.log("email", to, body, "failed", subject, error);
    return { ok: false, error };
  }
}
