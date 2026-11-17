import { chromium } from "playwright";
const base = "http://localhost:8090";
const logs = [], reqs = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("response", async (r) => {
  if (r.url().includes("form/invoice")) {
    let body = "";
    try { body = (await r.text()).slice(0, 250); } catch {}
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
await page.goto(base + "/persada/penjualan/bayar-customer/create", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.locator("button.btn-search").first().click();
await page.waitForTimeout(1500);
const dialog = page.locator(".v-overlay-container").last();
const search = dialog.locator("input").first();
if (await search.count()) { await search.fill("SL-004787"); await page.waitForTimeout(1500); }
const rows = dialog.locator("table tbody tr");
console.log("dialog rows:", await rows.count());
if (await rows.count()) {
  await rows.first().click({ force: true });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "C:/Users/hp/AppData/Local/Temp/opencode/bc-9.png" });
}
console.log("--- reqs invoice ---");
console.log(reqs.join("\n") || "(none)");
console.log("--- console tail ---");
console.log(logs.slice(-6).join("\n") || "(none)");
await browser.close();
