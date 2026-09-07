import { linkedinAds } from "./linkedin-ads.js";
import { snapchatAds, tiktokAds } from "./manual-ads.js";
import { metaAds } from "./meta-ads.js";
import type { AdPlatform, AdsAdapter } from "./types.js";

export const adsAdapters: Record<AdPlatform, AdsAdapter> = {
  meta: metaAds,
  linkedin: linkedinAds,
  tiktok: tiktokAds,
  snapchat: snapchatAds,
};

export function adapterFor(platform: AdPlatform): AdsAdapter {
  return adsAdapters[platform];
}
