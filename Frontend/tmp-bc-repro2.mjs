import { chromium } from "playwright";
const base = "http://localhost:8090";
const logs = [], reqs = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("response", async (r) => {
  if (r.url().includes("/api/penjualan/bayar-customer")) {
    let body = "";
    try { body = (await r.text()).slice(0, 300); } catch {}
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

// buka modal customer
await page.locator("input[placeholder='Pilih Customer...']").click();
await page.waitForTimeout(1500);
await page.screenshot({ path: "C:/Users/hp/AppData/Local/Temp/opencode/bc-2.png" });

// pilih customer pertama di modal
const rows = page.locator("table tbody tr, .modal tbody tr");
console.log("modal rows:", await rows.count());
if (await rows.count()) {
  await rows.first().click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "C:/Users/hp/AppData/Local/Temp/opencode/bc-3.png" });
}
console.log("--- reqs ---");
console.log(reqs.join("\n") || "(none)");
console.log("--- toasts/console ---");
console.log(logs.slice(-15).join("\n") || "(none)");
await browser.close();
