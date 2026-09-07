import type { ChannelId } from "../config.js";
import { instagramPublisher } from "./meta.js";
import { linkedinPublisher } from "./linkedin.js";
import { snapchatPublisher, tiktokPublisher } from "./manual.js";
import type { Publisher } from "./types.js";

export const publishers: Record<ChannelId, Publisher> = {
  instagram: instagramPublisher,
  linkedin: linkedinPublisher,
  tiktok: tiktokPublisher,
  snapchat: snapchatPublisher,
};

export function publisherFor(channel: ChannelId): Publisher {
  return publishers[channel];
}
