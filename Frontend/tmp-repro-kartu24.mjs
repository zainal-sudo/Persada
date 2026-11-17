import { chromium } from "playwright";
const base = "http://localhost:8090";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(base + "/persada/", { waitUntil: "networkidle" });
if (await page.locator("input[type=password]").count()) {
  await page.locator("input").first().fill("admin");
  await page.locator("input[type=password]").fill("admin123");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(4000);
}
await page.goto(base + "/persada/laporan/kartu-stok", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.keyboard.press("F5");
await page.waitForSelector(".v-data-table tbody tr td", { timeout: 30000 });
await page.waitForTimeout(3000);
let found = false;
for (let i = 0; i < 40 && !found; i++) {
  found = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".v-data-table tbody tr")).some((r) => r.textContent.includes("ACAROSE"))
  );
  if (!found) {
    await page.locator("button[aria-label='Next page'], .v-data-table__next, [aria-label='Halaman berikutnya']").first().click().catch(async () => {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const next = btns.find((b) => b.querySelector(".v-icon") && (b.getAttribute("aria-label") || "").toLowerCase().includes("next"));
        if (next) next.click();
      });
    });
    await page.waitForTimeout(1200);
  }
}
console.log("found:", found);
if (found) {
  await page.evaluate(() => {
    const tr = Array.from(document.querySelectorAll(".v-data-table tbody tr")).find((r) => r.textContent.includes("ACAROSE"));
    const td = tr.querySelector("td");
    td.click();
    const btn = tr.querySelector("button, .v-icon");
    if (btn) btn.click();
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "C:/Users/hp/AppData/Local/Temp/opencode/kstok10.png" });
  const rows = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".detail-table tbody tr"))
      .filter((r) => r.querySelectorAll("td").length > 5)
      .map((r) => Array.from(r.querySelectorAll("td")).map((c) => c.textContent.trim()).join(" | "))
  );
  console.log(rows.join("\n") || "(no detail rows)");
}
await browser.close();
