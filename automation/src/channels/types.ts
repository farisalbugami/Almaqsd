import type { ChannelId } from "../config.js";
import type { ActionResult, Post } from "../types.js";

export interface Publisher {
  id: ChannelId;
  /** api = نشر برمجي مباشر | manual = يُسلَّم جاهزًا لموظف ينشره (لا تتيح المنصة نشرًا برمجيًا للمحتوى العضوي) */
  mode: "api" | "manual";
  isConfigured(): boolean;
  publish(post: Post): Promise<ActionResult>;
}

export const GRAPH_VERSION = "v21.0";
