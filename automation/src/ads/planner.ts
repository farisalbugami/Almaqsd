import { campaign, type Audience } from "../config.js";
import { logger } from "../logger.js";
import { ads as adsRepo } from "../db/repo.js";
import { adapterFor } from "./registry.js";
import type { AdPlatform, CampaignSpec } from "./types.js";

/** المنصة الإعلانية التي تخدم كل قناة محتوى */
const PLATFORM_AUDIENCE_CHANNEL: Record<AdPlatform, string> = {
  meta: "instagram",
  linkedin: "linkedin",
  tiktok: "tiktok",
  snapchat: "snapchat",
};

const OBJECTIVE: Record<AdPlatform, string> = {
  meta: "عملاء محتملون (Leads)",
  linkedin: "نماذج عملاء محتملين (Lead Gen Forms)",
  tiktok: "زيارات ومشاهدات فيديو",
  snapchat: "زيارات باستهداف جغرافي",
};

function targetingBrief(platform: AdPlatform, audience: Audience): string {
  const geo = `${campaign.company.city} والمملكة`;
  if (platform === "linkedin") {
    return `${geo} — مسميات: مالك، رئيس مجلس إدارة، مدير استثمار، مدير أصول، مدير عام، مطوّر عقاري. القطاعات: العقارات، الإنشاءات، الاستثمار، إدارة الأصول. الشريحة: ${audience.name}.`;
  }
  if (platform === "snapchat") {
    return `استهداف جغرافي حول أحياء: القيروان، الملقا، النرجس، الياسمين، العليا، الملك عبدالله المالي. العمر 30+. الشريحة: ${audience.name}.`;
  }
  if (platform === "tiktok") {
    return `${geo} — العمر 28+، اهتمامات: عقارات، استثمار، أعمال. الشريحة: ${audience.name}.`;
  }
  return `${geo} — العمر 30+، اهتمامات: الاستثمار العقاري، إدارة الممتلكات، ريادة الأعمال. شرائح مشابهة لزوار صفحة الهبوط. الشريحة: ${audience.name}.`;
}

/**
 * يختار الشرائح حسب الأولوية، مع ضمان تمثيل كل مسار (ملاك/شراكات) بحملة واحدة
 * على الأقل ما دامت الميزانية تسمح — الهدفان معتمدان معًا، فلا يُهمَل أحدهما.
 */
function selectAudiences(eligible: Audience[], slots: number): Audience[] {
  if (slots <= 1) return eligible.slice(0, slots);

  const picked: Audience[] = [];
  for (const track of ["owners", "partners"] as const) {
    const top = eligible.find((a) => a.track === track);
    if (top && picked.length < slots) picked.push(top);
  }
  for (const a of eligible) {
    if (picked.length >= slots) break;
    if (!picked.includes(a)) picked.push(a);
  }
  return picked.sort((a, b) => a.adPriority - b.adPriority);
}

/** يبني خطة الحملات المدفوعة من توزيع الميزانية والشرائح */
export function buildAdPlan(): { platform: AdPlatform; spec: CampaignSpec }[] {
  const out: { platform: AdPlatform; spec: CampaignSpec }[] = [];
  const alloc = campaign.budget.allocation;

  for (const platform of Object.keys(PLATFORM_AUDIENCE_CHANNEL) as AdPlatform[]) {
    const monthly = alloc[platform];
    if (!monthly || monthly <= 0) continue;

    const channelId = PLATFORM_AUDIENCE_CHANNEL[platform];
    const eligible = campaign.audiences
      .filter((a) => (a.channels as string[]).includes(channelId))
      .sort((a, b) => a.adPriority - b.adPriority);
    if (eligible.length === 0) continue;

    /*
     * لا تُقسَّم الميزانية إلى حملات أصغر من الحد الأدنى للمنصة:
     * حملة دون هذا الحد لا تخرج من مرحلة التعلّم ولا تنتج بيانات صالحة للقرار.
     * لذلك يُقلَّص عدد الحملات ويُبقى على الشرائح الأعلى أولوية.
     */
    const dailyPool = monthly / 30;
    const minDaily = campaign.budget.minDailyBudget[platform] ?? 20;
    const maxCampaigns = Math.max(1, Math.floor(dailyPool / minDaily));
    const audiences = selectAudiences(eligible, Math.min(eligible.length, maxCampaigns));
    const perAudienceDaily = dailyPool / audiences.length;

    if (audiences.length < eligible.length) {
      logger.info(
        {
          platform,
          kept: audiences.map((a) => a.id),
          dropped: eligible.filter((a) => !audiences.includes(a)).map((a) => a.id),
        },
        "قُلّص عدد حملات المنصة للحفاظ على الحد الأدنى للميزانية اليومية"
      );
    }

    for (const audience of audiences) {
      out.push({
        platform,
        spec: {
          name: `المقصد | ${platform} | ${audience.id} | ${audience.track === "partners" ? "شراكات" : "ملاك"}`,
          audienceId: audience.id,
          objective: OBJECTIVE[platform],
          dailyBudget: Number(perAudienceDaily.toFixed(2)),
          targetingBrief: targetingBrief(platform, audience),
        },
      });
    }
  }

  /* إعادة الاستهداف — حملة واحدة على ميتا لزوار صفحة الهبوط */
  const retargeting = alloc.retargeting;
  if (retargeting && retargeting > 0) {
    out.push({
      platform: "meta",
      spec: {
        name: "المقصد | meta | إعادة استهداف | زوار الصفحة",
        audienceId: "A1",
        objective: "إعادة استهداف (Retargeting)",
        dailyBudget: Number((retargeting / 30).toFixed(2)),
        targetingBrief: "زوار صفحة الهبوط خلال 30 يومًا ولم يُكملوا النموذج + المتفاعلون مع الحساب.",
      },
    });
  }

  return out;
}

/** ينشئ الحملات المخططة (تبدأ متوقفة دائمًا — لا إنفاق بلا قرار بشري) */
export async function provisionCampaigns(): Promise<{ created: number; manual: number }> {
  const planItems = buildAdPlan();
  let created = 0;
  let manual = 0;

  for (const { platform, spec } of planItems) {
    const adapter = adapterFor(platform);
    const result = await adapter.createCampaign(spec);

    adsRepo.upsert({
      platform,
      external_id: result.externalId ?? null,
      name: spec.name,
      audience_id: spec.audienceId,
      objective: spec.objective,
      daily_budget: spec.dailyBudget,
      status: "draft",
    });

    if (result.externalId) created++;
    else manual++;
  }

  logger.info({ created, manual, total: planItems.length }, "تجهيز الحملات الإعلانية");
  return { created, manual };
}

/** يربط معرّف حملة أُنشئت يدويًا بسجلها في النظام */
export function linkExternalCampaign(platform: AdPlatform, externalId: string, namePart: string): boolean {
  const all = adsRepo.all().filter((c) => c.platform === platform && c.name.includes(namePart));
  const target = all[0];
  if (!target) return false;
  adsRepo.upsert({
    platform,
    external_id: externalId,
    name: target.name,
    audience_id: target.audience_id,
    objective: target.objective,
    daily_budget: target.daily_budget,
    status: "active",
  });
  adsRepo.logAction(target.id, "link", `رُبط المعرّف ${externalId}`);
  return true;
}
