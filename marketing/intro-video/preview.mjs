import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto("file:///tmp/claude-0/-home-user-Almaqsd/474d8ce8-62a1-50f0-a8f2-7e31cf8ad046/scratchpad/video/film.html");
await page.waitForFunction(() => window.READY && document.fonts.ready.then(() => true));
await page.waitForTimeout(800);
const n = await page.locator(".scene").count();
for (let i = 0; i < n; i++) {
  await page.evaluate((idx) => {
    document.querySelectorAll(".scene").forEach((s) => s.classList.remove("in"));
    const s = document.querySelectorAll(".scene")[idx];
    s.classList.add("in");
    s.querySelectorAll("[data-count]").forEach((el) => {
      el.innerHTML = (el.dataset.prefix || "") + (+el.dataset.count).toLocaleString("en-US") + (el.dataset.suffix || "");
    });
  }, i);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `/tmp/claude-0/-home-user-Almaqsd/474d8ce8-62a1-50f0-a8f2-7e31cf8ad046/scratchpad/video/scene${i + 1}.png` });
}
console.log("scenes:", n);
await browser.close();
