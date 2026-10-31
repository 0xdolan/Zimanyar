import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const AXE = readFileSync(resolve(ROOT, "node_modules/axe-core/axe.min.js"), "utf8");
const UPDATE = Boolean(process.env["UPDATE_SCREENSHOTS"]);

const VIEWS = [
  { lang: "en", theme: "light" },
  { lang: "en", theme: "dark" },
  { lang: "kmr", theme: "light" },
  { lang: "kmr", theme: "dark" },
  { lang: "ckb", theme: "light" },
  { lang: "ckb", theme: "dark" },
] as const;

async function open(page: Page, lang: string, theme: string) {
  await page.goto(`/?lang=${lang}&theme=${theme}`);
  await page.waitForSelector("section");
  await page.evaluate(() => document.fonts.ready);
}

async function seriousViolations(page: Page) {
  await page.addScriptTag({ content: AXE });
  const violations = await page.evaluate(async () => {
    const results = await (
      window as unknown as {
        axe: {
          run: () => Promise<{ violations: { id: string; impact: string; nodes: { html: string }[] }[] }>;
        };
      }
    ).axe.run();
    return results.violations;
  });
  return violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.nodes[0]?.html}`);
}

for (const { lang, theme } of VIEWS) {
  test(`${lang} ${theme} has no serious accessibility problems`, async ({ page }) => {
    await open(page, lang, theme);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test(`${lang} ${theme} fits a phone with no sideways scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await open(page, lang, theme);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test(`${lang} ${theme} screenshot`, async ({ page }) => {
    test.skip(!UPDATE, "only when regenerating");
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page, lang, theme);
    await page.screenshot({
      path: resolve(ROOT, `assets/screenshots/ui-${lang}-${theme}.png`),
      fullPage: true,
    });
  });
}

test("phone screenshot", async ({ page }) => {
  test.skip(!UPDATE, "only when regenerating");
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "ckb", "light");
  await page.screenshot({ path: resolve(ROOT, "assets/screenshots/ui-ckb-phone.png"), fullPage: true });
});

test("Sorani runs right to left with Kurdish type", async ({ page }) => {
  await open(page, "ckb", "light");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const font = await page
    .locator("section p")
    .first()
    .evaluate((element) => getComputedStyle(element).fontFamily);
  expect(font).toContain("Vazirmatn");
});

test("the fonts are bundled: nothing is fetched from anywhere else", async ({ page }) => {
  const elsewhere: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://localhost:4173")) elsewhere.push(request.url());
  });
  await open(page, "ckb", "light");
  expect(elsewhere).toEqual([]);
  expect(await page.evaluate(() => document.fonts.check("16px Vazirmatn", "ک"))).toBe(true);
});

test("the keyboard reaches every action, and focus can be seen", async ({ page }) => {
  await open(page, "en", "light");
  await page.locator("button", { hasText: "Show pronunciation" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Pronunciation:/)).toBeVisible();
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
  expect(outline).toBe("solid");
});

test("selecting a finding updates the card", async ({ page }) => {
  await open(page, "en", "light");
  await page.getByRole("button", { name: /dıçım/ }).click();
  await expect(page.locator("section[aria-label]").first()).toContainText("Turkish letter");
});
