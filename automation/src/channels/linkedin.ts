import { env } from "../config.js";
import { logger } from "../logger.js";
import type { ActionResult, Post } from "../types.js";
import type { Publisher } from "./types.js";

export const linkedinPublisher: Publisher = {
  id: "linkedin",
  mode: "api",

  isConfigured(): boolean {
    return Boolean(env.linkedin.accessToken && env.linkedin.orgUrn);
  },

  async publish(post: Post): Promise<ActionResult> {
    if (env.dryRun || !this.isConfigured()) {
      logger.info({ postId: post.id }, "[محاكاة] نشر لينكدإن");
      return { ok: true, simulated: true, externalId: `sim-li-${post.id}` };
    }

    const tags = post.hashtags
      ? "\n\n" +
        post.hashtags
          .split(/[,\s]+/)
          .filter(Boolean)
          .map((t) => (t.startsWith("#") ? t : `#${t}`))
          .join(" ")
      : "";
    const commentary = `${post.body ?? ""}\n\n${post.cta ?? ""}${tags}`.trim();

    try {
      const res = await fetch("https://api.linkedin.com/rest/posts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.linkedin.accessToken}`,
          "Content-Type": "application/json",
          "LinkedIn-Version": "202506",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          author: env.linkedin.orgUrn,
          commentary,
          visibility: "PUBLIC",
          distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `لينكدإن ${res.status}: ${text.slice(0, 300)}` };
      }
      const id = res.headers.get("x-restli-id") ?? undefined;
      return { ok: true, externalId: id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
