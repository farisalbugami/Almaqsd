import { campaign } from "../config.js";

export interface ScoreInput {
  source: string;
  propertyType?: string | null;
  units?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface ScoreResult {
  score: number;
  qualified: boolean;
  hot: boolean;
  reasons: string[];
}

/** تأهيل العميل المحتمل بالنقاط — الأوزان في campaign.yaml */
export function scoreLead(input: ScoreInput): ScoreResult {
  const cfg = campaign.leadScoring;
  const reasons: string[] = [];
  let score = 0;

  const unitPoints = input.units ? cfg.units[input.units] : undefined;
  if (unitPoints !== undefined) {
    score += unitPoints;
    reasons.push(`عدد الوحدات (${input.units}): +${unitPoints}`);
  }

  const typePoints = input.propertyType ? cfg.propertyType[input.propertyType] : undefined;
  if (typePoints !== undefined) {
    score += typePoints;
    reasons.push(`نوع العقار (${input.propertyType}): +${typePoints}`);
  }

  const sourcePoints = cfg.sourceBonus[input.source];
  if (sourcePoints !== undefined) {
    score += sourcePoints;
    reasons.push(`المصدر (${input.source}): +${sourcePoints}`);
  }

  if (input.email) {
    score += 5;
    reasons.push("بريد إلكتروني متاح: +5");
  }

  return {
    score,
    qualified: score >= cfg.qualifiedThreshold,
    hot: score >= cfg.hotThreshold,
    reasons,
  };
}
