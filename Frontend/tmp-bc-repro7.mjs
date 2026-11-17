import { chromium } from "playwright";
const base = "http://localhost:8090";
const logs = [], reqs = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("response", async (r) => {
  if (r.url().includes("bayar-customer")) {
    let body = "";
    try { body = (await r.text()).slice(0, 200); } catch {}
    reqs.push(`${r.status()} ${r.request().method()} ${r.url().replace(base,"")} => ${body}`);
  }
});
await page.goto(base + "/persada/", { waitUntil: "networkidle" });
if (await page.locator("input[type=password]").count()) {
  await page.locator("input").first().fill("admin");
  await page.locator("input[type=password]").fill("admin123");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(4000);
}
await page.goto(base + "/persada/penjualan/bayar-customer/edit/AM-CR.2611.0001", { waitUntil: "networkidle" });
await page.waitForTimeout(5000);
await page.screenshot({ path: "C:/Users/hp/AppData/Local/Temp/opencode/bc-10.png" });
console.log("--- reqs ---");
console.log(reqs.join("\n") || "(none)");
console.log("--- console errors ---");
console.log(logs.filter(l => l.startsWith("[error") || l.startsWith("[pageerror")).join("\n") || "(none)");
await browser.close();
