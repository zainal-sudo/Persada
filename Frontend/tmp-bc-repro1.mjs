import { chromium } from "playwright";
const base = "http://localhost:8090";
const logs = [], reqs = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("response", (r) => { if (r.url().includes("/api/")) reqs.push(`${r.status()} ${r.request().method()} ${r.url().replace(base,"")}`); });

await page.goto(base + "/persada/", { waitUntil: "networkidle" });
if (await page.locator("input[type=password]").count()) {
  await page.locator("input").first().fill("admin");
  await page.locator("input[type=password]").fill("admin123");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(4000);
}
await page.goto(base + "/persada/penjualan/bayar-customer/create", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
reqs.length = 0; logs.length = 0;

// buka modal customer — cari tombol/input customer
const custInput = page.locator("input[placeholder*='ustomer'], input[placeholder*='Pilih']").first();
console.log("cust input count:", await page.locator("input").count());
await page.screenshot({ path: "C:/Users/hp/AppData/Local/Temp/opencode/bc-1.png" });
const searchInputs = page.locator("input");
const n = await searchInputs.count();
for (let i = 0; i < n; i++) {
  const ph = await searchInputs.nth(i).getAttribute("placeholder").catch(()=>null);
  const ro = await searchInputs.nth(i).getAttribute("readonly").catch(()=>null);
  console.log("input", i, "placeholder:", ph, "readonly:", ro);
}
console.log("reqs:", reqs.slice(-10).join(" | "));
await browser.close();
