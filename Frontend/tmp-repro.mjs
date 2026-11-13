import { chromium } from "playwright";

const base = "http://localhost:8090";
const logs = [];

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(base + "/persada/", { waitUntil: "networkidle" });

// Login
if (await page.locator("input[type=password]").count()) {
  await page.locator("input").first().fill("admin");
  await page.locator("input[type=password]").fill("admin123");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(4000);
}
console.log("after login url:", page.url());

// Navigasi langsung ke route salesman-aktif
await page.goto(base + "/persada/daftar/salesman-aktif", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
console.log("direct nav url:", page.url());
console.log("--- console after direct nav (last 15) ---");
console.log(logs.slice(-15).join("\n"));
await page.screenshot({ path: "tmp-shot-direct.png" });

// Coba klik menu dari dashboard
await page.goto(base + "/persada/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
logs.length = 0;
const menu = page.locator("aside").getByText("Salesman", { exact: true }).first();
await menu.click();
await page.waitForTimeout(2500);
console.log("after click url:", page.url());
console.log("--- console after click ---");
console.log(logs.join("\n") || "(kosong)");
await page.screenshot({ path: "tmp-shot-click.png" });

await browser.close();
