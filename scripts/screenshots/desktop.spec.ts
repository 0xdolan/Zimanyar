import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const AXE = readFileSync(resolve(ROOT, "node_modules/axe-core/axe.min.js"), "utf8");
const DIST = resolve(ROOT, "apps/desktop/dist");
const CONFIG = resolve(ROOT, "apps/desktop/src-tauri");
const UPDATE = Boolean(process.env["UPDATE_SCREENSHOTS"]);
const APP = "http://localhost:4177/";

/** The app's own pages in a browser, without the native shell. packaging/linux/smoke-test.sh runs the real one. */
async function open(page: Page, path = "") {
  await page.goto(`${APP}${path}`);
  await page.waitForSelector("main");
  await page.evaluate(() => document.fonts.ready);
}

const field = (page: Page) => page.getByRole("textbox").first();

test("the main window is the same app as the extension's full view", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("button", { name: "Checker" })).toBeVisible();
  await field(page).fill("Min tu dîtim.");
  await page.getByRole("button", { name: /dîtim/ }).first().click();
  await page.getByRole("button", { name: "Replace with dîtî" }).click();
  await expect(field(page)).toHaveValue("Min tu dîtî.");
  await page.getByRole("button", { name: "Learn" }).click();
  await page.getByRole("link", { name: /7\. Nouns/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Nouns");
});

test("the checker has its real lexicon, in a worker", async ({ page }) => {
  await open(page);
  await field(page).fill("Ez kitêbek zxqjw dixwînim.");
  await expect(page.getByRole("button", { name: /zxqjw/ }).first()).toBeVisible({ timeout: 10_000 });
});

test("a dropped text file opens, and others are refused with a reason", async ({ page }) => {
  await open(page);
  const drop = (name: string, content: string) =>
    page.evaluate(
      ([fileName, text]) => {
        const data = new DataTransfer();
        data.items.add(new File([text as string], fileName as string));
        window.dispatchEvent(new DragEvent("drop", { dataTransfer: data, bubbles: true, cancelable: true }));
      },
      [name, content],
    );
  await drop("notes.md", "Ez ez hatim.");
  await expect(field(page)).toHaveValue("Ez ez hatim.");
  await drop("photo.png", "x");
  await expect(page.getByRole("alert")).toContainText(".txt");
  await expect(field(page)).toHaveValue("Ez ez hatim.");
});

test("the quick window checks the clipboard, and copies the corrected text back", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("clipboard", "Min tu dîtim. Ez dıçım malê."));
  await open(page, "quick.html");
  await expect(field(page)).toHaveValue("Min tu dîtim. Ez dıçım malê.");
  await page.getByRole("button", { name: "Fix all safe" }).click();
  await expect(field(page)).toHaveValue("Min tu dîtim. Ez diçim malê.");
  await page.getByRole("button", { name: "Copy back and close" }).click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("clipboard")))
    .toBe("Min tu dîtim. Ez diçim malê.");
});

test("the quick window says so when the clipboard has no text", async ({ page }) => {
  await open(page, "quick.html");
  await expect(page.getByText("The clipboard has no text")).toBeVisible();
});

test("settings persist across a restart, and reach the checker", async ({ page }) => {
  await open(page, "settings.html");
  await page.getByRole("checkbox", { name: /Word order/ }).uncheck();
  await page.getByLabel("Language of the interface").selectOption("ckb");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.reload();
  await page.waitForSelector("main");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 2 }).filter({ hasText: "ماڵپەڕ" })).toHaveCount(0);
});

for (const uiLang of ["en", "ckb", "kmr"]) {
  for (const theme of ["light", "dark"]) {
    test(`no serious accessibility problems (${uiLang}, ${theme})`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.addInitScript(
        (settings) => localStorage.setItem("zimanyar-settings", settings),
        JSON.stringify({ interface: { uiLang, theme } }),
      );
      for (const path of ["", "settings.html", "quick.html", "#/learn/kmr/14", "#/verbs", "#/tools"]) {
        await open(page, path);
        await page.waitForTimeout(250);
        await page.evaluate(AXE);
        await page.evaluate(() =>
          Promise.allSettled(document.getAnimations().map((animation) => animation.finished)),
        );
        const violations = await page.evaluate(async () => {
          const results = await (
            window as unknown as {
              axe: {
                run(): Promise<{
                  violations: { id: string; impact: string; nodes: { target: unknown }[] }[];
                }>;
              };
            }
          ).axe.run();
          return results.violations
            .filter((found) => found.impact === "serious" || found.impact === "critical")
            .map(
              (found) => `${found.id}: ${JSON.stringify(found.nodes.map((node) => node.target).slice(0, 3))}`,
            );
        });
        expect([path, violations]).toEqual([path, []]);
      }
    });
  }
}

test.describe("privacy", () => {
  test("no request leaves the app", async ({ page }) => {
    const outside: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith(APP) && !url.startsWith("data:") && !url.startsWith("blob:")) outside.push(url);
    });
    await open(page);
    await field(page).fill("Min tu dîtim. kit");
    await page.waitForTimeout(800);
    await open(page, "settings.html");
    await open(page, "quick.html");
    expect(outside).toEqual([]);
  });

  test("the only fetch in the build reads its own lexicons", () => {
    const found: string[] = [];
    const walk = (folder: string) => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = join(folder, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (path.endsWith(".js")) {
          const code = readFileSync(path, "utf8");
          for (const hit of code.match(/\b(?:XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/g) ?? []) {
            found.push(`${relative(DIST, path)}: ${hit}`);
          }
          for (const [hit] of code.matchAll(/\bfetch\([^)]{0,60}/g)) {
            if (!hit.includes("lexicons/lexicon-")) found.push(`${relative(DIST, path)}: ${hit}`);
          }
        }
      }
    };
    walk(DIST);
    expect(found).toEqual([]);
  });

  test("the policy and capabilities give a window only what it needs", () => {
    const config = JSON.parse(readFileSync(join(CONFIG, "tauri.conf.json"), "utf8")) as {
      app: { security: { csp: string; assetProtocol: { enable: boolean } } };
    };
    const csp = config.app.security.csp;
    expect(csp).toContain("connect-src 'self' ipc: http://ipc.localhost;");
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/https?:\/\/(?!ipc\.localhost)/);
    expect(config.app.security.assetProtocol.enable).toBe(false);

    const permissions = (name: string) =>
      (
        JSON.parse(readFileSync(join(CONFIG, `capabilities/${name}.json`), "utf8")) as {
          permissions: string[];
        }
      ).permissions;
    expect(permissions("main").sort()).toEqual([
      "core:event:default",
      "dialog:allow-open",
      "dialog:allow-save",
      "fs:allow-read-text-file",
      "fs:allow-write-text-file",
    ]);
    // Only the quick window can touch the clipboard, and neither window can reach a file nobody chose.
    expect(permissions("main").some((permission) => permission.startsWith("clipboard"))).toBe(false);
    expect(
      [...permissions("main"), ...permissions("quick")].some((permission) => permission.includes("scope")),
    ).toBe(false);
  });
});

test("screenshots of the desktop app", async ({ page }) => {
  test.skip(!UPDATE, "only when regenerating");
  test.setTimeout(60_000);
  const shoot = (name: string) => page.screenshot({ path: resolve(ROOT, `assets/screenshots/${name}.png`) });
  await page.setViewportSize({ width: 1100, height: 760 });
  await open(page);
  await page.waitForTimeout(1000);
  await shoot("desktop-main");
  await open(page, "settings.html");
  await page.waitForTimeout(200);
  await shoot("desktop-settings");
  await page.setViewportSize({ width: 560, height: 640 });
  await page.addInitScript(() => sessionStorage.setItem("clipboard", "دەرگاەکە کرایەوە. ئەو رۆژە هات."));
  await open(page, "quick.html");
  await page.waitForTimeout(1000);
  await shoot("desktop-quick");
});
