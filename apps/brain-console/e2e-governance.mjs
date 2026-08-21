import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on("console", msg => console.log("CONSOLE:", msg.type(), msg.text()));
  page.on("pageerror", err => console.log("PAGE ERROR:", err.message));
  page.on("requestfailed", req => console.log("FAILED:", req.url(), req.failure()?.errorText));
  
  await page.goto("http://127.0.0.1:7777/#/governance", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  
  const html = await page.content();
  console.log("HTML:\n", html);
  
  await browser.close();
})();
