import { chromium } from "playwright";
import fs from "node:fs";

const DIR = "/tmp/claude-0/-home-user-Almaqsd/474d8ce8-62a1-50f0-a8f2-7e31cf8ad046/scratchpad/video";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1",
         "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required"],
});
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: `${DIR}/raw`, size: { width: 1920, height: 1080 } },
});
const page = await ctx.newPage();
await page.goto(`file://${DIR}/film.html`);
await page.waitForFunction(() => window.READY === true, null, { timeout: 20000 });
console.log("جاهز");
await page.evaluate(() => document.fonts.ready.then(() => true));
await page.waitForTimeout(1200);
console.log("تشغيل…");
await page.evaluate(() => window.PLAY());
await page.waitForTimeout(59500);
await page.waitForTimeout(900);
const video = page.video();
await ctx.close();
const src = await video.path();
fs.renameSync(src, `${DIR}/raw.webm`);
console.log("خام:", fs.statSync(`${DIR}/raw.webm`).size, "بايت");
await browser.close();
