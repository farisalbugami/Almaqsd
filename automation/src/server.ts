import express, { type Request, type Response } from "express";
import { campaign, env } from "./config.js";
import { logger } from "./logger.js";
import { ads as adsRepo, leads as leadsRepo, posts as postsRepo } from "./db/repo.js";
import { handleApprovalReply, replyTo } from "./approvals/service.js";
import { intakeLead } from "./leads/pipeline.js";
import { linkExternalCampaign } from "./ads/planner.js";
import { recordManualMetrics } from "./ads/optimizer.js";
import { buildDailyReport } from "./reports/index.js";
import type { AdPlatform } from "./ads/types.js";

export function createServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  /* ───────────────── فحص الصحة ───────────────── */
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      dryRun: env.dryRun,
      company: campaign.company.shortName,
      posts: postsRepo.countsByStatus(),
      leads: leadsRepo.countsByStatus(),
      adCampaigns: adsRepo.all().length,
    });
  });

  /* ───────────────── نموذج صفحة الهبوط ───────────────── */
  app.post("/webhooks/lead", async (req: Request, res: Response) => {
    const token = req.get("x-webhook-secret") ?? String(req.query.token ?? "");
    if (env.webhookSecret && token !== env.webhookSecret) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const b = req.body as Record<string, unknown>;
    const name = String(b.name ?? "").trim();
    const phone = String(b.phone ?? "").trim();
    if (!name || !phone) {
      res.status(400).json({ ok: false, error: "الاسم ورقم الجوال مطلوبان" });
      return;
    }

    try {
      const result = await intakeLead({
        name,
        phone,
        email: b.email ? String(b.email) : null,
        source: b.source ? String(b.source) : "landing",
        propertyType: b.type ? String(b.type) : null,
        units: b.units ? String(b.units) : null,
        city: b.city ? String(b.city) : null,
        notes: b.notes ? String(b.notes) : null,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      logger.error({ err: String(err) }, "فشل استقبال عميل محتمل");
      res.status(500).json({ ok: false });
    }
  });

  /* ───────────────── إعلانات ميتا للعملاء المحتملين ───────────────── */
  app.post("/webhooks/meta-leads", async (req: Request, res: Response) => {
    res.sendStatus(200); // ميتا تتطلب ردًا فوريًا
    try {
      const body = req.body as {
        entry?: { changes?: { value?: { field_data?: { name: string; values: string[] }[] } }[] }[];
      };
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const fields = change.value?.field_data ?? [];
          const get = (key: string) =>
            fields.find((f) => f.name.includes(key))?.values?.[0] ?? null;

          const name = get("name") ?? get("full_name");
          const phone = get("phone");
          if (!name || !phone) continue;

          await intakeLead({
            name,
            phone,
            email: get("email"),
            source: "instagram",
            propertyType: get("property"),
            units: get("units"),
            city: get("city"),
          });
        }
      }
    } catch (err) {
      logger.error({ err: String(err) }, "فشل معالجة عملاء ميتا");
    }
  });

  /* ───────────────── واتساب: التحقق ───────────────── */
  app.get("/webhooks/whatsapp", (req: Request, res: Response) => {
    if (
      req.query["hub.mode"] === "subscribe" &&
      req.query["hub.verify_token"] === env.whatsapp.verifyToken
    ) {
      res.status(200).send(String(req.query["hub.challenge"] ?? ""));
      return;
    }
    res.sendStatus(403);
  });

  /* ───────────────── واتساب: الرسائل الواردة ───────────────── */
  app.post("/webhooks/whatsapp", async (req: Request, res: Response) => {
    res.sendStatus(200);
    try {
      const body = req.body as {
        entry?: { changes?: { value?: { messages?: { from: string; text?: { body: string } }[] } }[] }[];
      };
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          for (const msg of change.value?.messages ?? []) {
            const text = msg.text?.body ?? "";
            if (!text.trim()) continue;
            await handleInbound(msg.from, text);
          }
        }
      }
    } catch (err) {
      logger.error({ err: String(err) }, "فشل معالجة رسالة واتساب واردة");
    }
  });

  return app;
}

/* ───────────────── موجّه الرسائل الواردة ───────────────── */

const PLATFORM_ALIASES: Record<string, AdPlatform> = {
  ميتا: "meta",
  meta: "meta",
  انستقرام: "meta",
  لينكدإن: "linkedin",
  لينكدان: "linkedin",
  linkedin: "linkedin",
  تيكتوك: "tiktok",
  tiktok: "tiktok",
  سناب: "snapchat",
  snapchat: "snapchat",
};

export async function handleInbound(from: string, text: string): Promise<void> {
  const isApprover = env.whatsapp.approvers.includes(from.replace(/\D/g, ""));

  if (isApprover) {
    /* أمر: ربط <منصة> <معرّف> <جزء من الاسم> */
    const link = /^ربط\s+(\S+)\s+(\S+)\s+(.+)$/.exec(text.trim());
    if (link) {
      const platform = PLATFORM_ALIASES[link[1]!.toLowerCase()];
      if (!platform) {
        await replyTo(from, "منصة غير معروفة. استخدم: ميتا | لينكدإن | تيكتوك | سناب");
        return;
      }
      const ok = linkExternalCampaign(platform, link[2]!, link[3]!.trim());
      await replyTo(from, ok ? `✅ رُبطت الحملة بالمعرّف ${link[2]}.` : "لم أجد حملة مطابقة لهذا الاسم.");
      return;
    }

    /* أمر: قياس <معرّف> <إنفاق> <ظهور> <نقرات> <عملاء> */
    const metric = /^قياس\s+(\S+)\s+([\d.]+)\s+(\d+)\s+(\d+)\s+(\d+)/.exec(text.trim());
    if (metric) {
      const ok = recordManualMetrics(metric[1]!, {
        spend: Number(metric[2]),
        impressions: Number(metric[3]),
        clicks: Number(metric[4]),
        leads: Number(metric[5]),
      });
      await replyTo(from, ok ? "📊 سُجّلت الأرقام." : "لم أجد حملة بهذا المعرّف.");
      return;
    }

    if (/^تقرير/.test(text.trim())) {
      await replyTo(from, buildDailyReport());
      return;
    }

    const approvalReply = await handleApprovalReply(from, text);
    if (approvalReply) {
      await replyTo(from, approvalReply);
      return;
    }

    await replyTo(
      from,
      [
        "الأوامر المتاحة:",
        "`موافق A001` · `موافق الكل`",
        "`رفض A001 السبب` · `تعديل A001 الملاحظة`",
        "`عرض A001` · `حالة` · `تقرير`",
        "`ربط لينكدإن <معرّف> <اسم الحملة>`",
        "`قياس <معرّف> <إنفاق> <ظهور> <نقرات> <عملاء>`",
      ].join("\n")
    );
    return;
  }

  /* رسالة من عميل محتمل */
  const lead = leadsRepo.byPhone(from.replace(/\D/g, ""));
  if (lead) {
    leadsRepo.addEvent(lead.id, "inbound_message", { text });
    if (lead.status === "new" || lead.status === "contacted") {
      leadsRepo.setStatus(lead.id, "qualified");
    }
    logger.info({ leadId: lead.id }, "رد وارد من عميل محتمل");
  } else {
    await intakeLead({ name: "استفسار واتساب", phone: from, source: "whatsapp", notes: text });
  }
}
