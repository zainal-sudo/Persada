import { chromium } from "playwright";

const base = "http://localhost:8090";
const logs = [];
const api = [];

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("response", (r) => {
  if (r.url().includes("/api/")) api.push(`${r.status()} ${r.request().method()} ${r.url()}`);
});

await page.goto(base + "/persada/", { waitUntil: "networkidle" });
if (await page.locator("input[type=password]").count()) {
  await page.locator("input").first().fill("admin");
  await page.locator("input[type=password]").fill("admin123");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(4000);
}

await page.locator("aside").getByText("Salesman", { exact: true }).first().click();
await page.waitForTimeout(3500);

console.log("url:", page.url());
console.log("--- API calls ---");
console.log(api.filter((x) => x.includes("salesman")).join("\n") || "(tidak ada call salesman)");
console.log("--- console (last 10) ---");
console.log(logs.slice(-10).join("\n"));
await page.screenshot({ path: "tmp-shot3.png" });
await browser.close();
