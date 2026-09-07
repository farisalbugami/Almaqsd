import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { ROOT } from "../config.js";
import { logger } from "../logger.js";

const dataDir = path.join(ROOT, "data");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, "almaqsd.db"));

const schema = fs.readFileSync(path.join(ROOT, "src", "db", "schema.sql"), "utf8");
db.exec(schema);
logger.debug("قاعدة البيانات جاهزة");

export function kvGet(key: string): string | null {
  const row = db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function kvSet(key: string, value: string): void {
  db.prepare("INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
}
