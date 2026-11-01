import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type BrowserContext, chromium, expect, type Page, test } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const AXE = readFileSync(resolve(ROOT, "node_modules/axe-core/axe.min.js"), "utf8");
const BUILD = resolve(ROOT, "apps/extension/.output/e2e-chrome-mv3");
const UPDATE = Boolean(process.env["UPDATE_SCREENSHOTS"]);
const SITE = "http://localhost:4176";

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>A page</title></head>
<body><h1>A page</h1>
<textarea id="field" rows="6" cols="60" aria-label="field" style="font-size:20px"></textarea>
<div id="rich" contenteditable="true" style="font-size:20px;min-height:80px;border:1px solid #888"></div>
<input id="secret" type="password" aria-label="secret">
</body></html>`;

let context: BrowserContext;
let extensionId: string;
let profile: string;

/** A fresh browser with the unpacked extension, in a throwaway profile. */
test.beforeEach(async () => {
  profile = mkdtempSync(join(tmpdir(), "zimanyar-"));
  context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${BUILD}`, `--load-extension=${BUILD}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  extensionId = new URL(worker.url()).host;
  await context.route(`${SITE}/**`, (route) => route.fulfill({ contentType: "text/html", body: PAGE }));
});

test.afterEach(async () => {
  await context.close();
  rmSync(profile, { recursive: true, force: true });
});

const extensionUrl = (page: string) => `chrome-extension://${extensionId}/${page}`;

/** Settings as the settings page writes them. The background registers the content script from them. */
async function setSettings(values: object) {
  const page = await context.newPage();
  await page.goto(extensionUrl("options.html"));
  await page.evaluate((settings) => chrome.storage.local.set({ settings }), values);
  await page.close();
}

async function openSite(values: object = {}): Promise<Page> {
  await setSettings({ sites: { enabled: [SITE] }, ...values });
  const page = await context.newPage();
  await expect(async () => {
    await page.goto(`${SITE}/`);
    await page.locator("#field").click();
    await expect(page.locator("html > div")).toHaveCount(1, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  return page;
}

/** Hover over an underlined finding, which is how the stories begin. */
async function hoverFirstUnderline(page: Page, kind = ".zy-underline") {
  const line = page.locator(kind).first();
  await line.waitFor();
  const box = await line.boundingBox();
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) - 6);
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2 + 1, (box?.y ?? 0) - 6);
}

test.describe("user stories", () => {
  test("1: a Sorani mistake is underlined, explained and fixed, with a lesson to go to", async () => {
    const page = await openSite();
    await page.locator("#field").pressSequentially("دەرگاەکە کرایەوە");
    await hoverFirstUnderline(page);
    const card = page.locator(".zy-floating");
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: /دەرگاکە/ })).toBeVisible();
    await expect(card.getByRole("table")).toBeVisible();
    const lesson = card.getByRole("button", { name: /Lesson 7/ });
    await expect(lesson).toBeVisible();

    const opened = context.waitForEvent("page");
    await lesson.click();
    const reader = await opened;
    await expect(reader).toHaveURL(/app\.html#\/learn\/ckb\/7/);
    await expect(reader.getByRole("heading", { level: 1 })).toContainText("Nouns");
    await expect(reader.getByRole("cell", { name: "پیاوەکە" }).first()).toBeVisible();
    const anchor = new URL(reader.url()).hash.split("/").at(-1) as string;
    await expect(reader.locator(`[id="${anchor}"]`)).toHaveCount(1);
  });

  test("1: applying the fix changes the text, and undo brings it back", async () => {
    const page = await openSite();
    await page.locator("#field").pressSequentially("دەرگاەکە کرایەوە");
    await hoverFirstUnderline(page);
    await page
      .locator(".zy-floating")
      .getByRole("button", { name: /دەرگاکە/ })
      .click();
    await expect(page.locator("#field")).toHaveValue("دەرگاکە کرایەوە");
    await page.locator("#field").focus();
    await page.keyboard.press("Control+z");
    await expect(page.locator("#field")).toHaveValue("دەرگاەکە کرایەوە");
  });

  test("2: Kurmanji agreement in the past, with the fix, reason, diagram and lesson 14", async () => {
    const page = await openSite();
    await page.locator("#field").pressSequentially("Min tu dîtim.");
    await hoverFirstUnderline(page);
    const card = page.locator(".zy-floating");
    await expect(card).toContainText("agrees with the object");
    await expect(card.getByRole("button", { name: /dîtî/ })).toBeVisible();
    await expect(card).toContainText("Why");
    await expect(card.getByRole("figure")).toContainText("min tu dîtî");
    const box = await card.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
    await expect(card.getByRole("button", { name: /Lesson 14/ })).toBeVisible();
  });

  for (const [name, article, limit] of [
    // About one mistake in forty words, which is already careless writing.
    [
      "an article",
      `${"Ez diçim malê û kitêb dixwînim. Tu li malê yî û em ê sibê biçin. Ew jî hat û me nan xwar û em çûn bajêr. ".repeat(10)}Min tu dîtim. Ez dıçım malê. `.repeat(
        8,
      ),
      1000,
    ],
    // Nothing but mistakes, which only has to stay usable.
    [
      "a text of nothing but mistakes",
      "Min tu dîtim. Ez ez hatim. Ez dıçım malê û kitêb dixwînim. ".repeat(190),
      2000,
    ],
  ] as const) {
    test(`3: 2000 words of ${name} in the full view show findings by category in time`, async () => {
      const page = await context.newPage();
      await page.goto(extensionUrl("app.html#/check"));
      const field = page.getByRole("textbox").first();
      await field.fill("Ez hatim.");
      await page.waitForTimeout(1000);
      expect(article.split(" ").length).toBeGreaterThan(1900);
      const started = Date.now();
      await field.fill(article);
      await expect(page.getByRole("heading", { name: "Agreement" })).toBeVisible({ timeout: 5000 });
      const elapsed = Date.now() - started;
      console.log(`2000 words of ${name}: ${elapsed} ms`);
      expect(elapsed).toBeLessThan(limit);
      await page.getByRole("button", { name: "Fix all safe" }).click();
      await expect(field).not.toHaveValue(/dıçım/);
      await expect(field).toHaveValue(/Min tu dîtim/);
      await field.focus();
      await page.keyboard.press("Control+z");
      await expect(field).toHaveValue(/dıçım/);
    });
  }

  test("4: typing kit in Kurmanji offers words, and conjugations for a verb stem", async () => {
    const page = await openSite();
    await page.locator("#field").pressSequentially("kit");
    const list = page.getByRole("listbox");
    await expect(list).toBeVisible();
    const words = await list.getByRole("option").allTextContents();
    expect(words.join(" ")).toContain("kitêb");
    await page.keyboard.press("Tab");
    await expect(page.locator("#field")).toHaveValue(/^kitêb/);
    await page.locator("#field").fill("");
    await page.locator("#field").pressSequentially("dîtin");
    await expect(list).toBeVisible();
    expect((await list.getByRole("option").allTextContents()).length).toBeGreaterThan(0);
  });
});

test.describe("the page", () => {
  test("keeps Zimanyar out of sites that were not turned on", async () => {
    await setSettings({});
    const page = await context.newPage();
    await page.goto(`${SITE}/`);
    await page.locator("#field").click();
    await page.waitForTimeout(500);
    await expect(page.locator("html > div")).toHaveCount(0);
  });

  test("never reads a password field", async () => {
    const page = await openSite();
    const before = await page.locator("html > div").count();
    await page.locator("#secret").click();
    await page.locator("#secret").pressSequentially("kit");
    await page.waitForTimeout(400);
    await expect(page.locator("html > div")).toHaveCount(before);
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("works in a contenteditable element", async () => {
    const page = await openSite();
    await page.locator("#rich").click();
    await page.locator("#rich").pressSequentially("Min tu dîtim.");
    await expect(page.locator(".zy-underline").first()).toBeVisible();
  });

  test("follows the settings: a personal word, teaching off, a language turned off", async () => {
    const page = await openSite({ teaching: { mode: false } });
    await page.locator("#field").pressSequentially("Min tu dîtim.");
    await hoverFirstUnderline(page);
    const card = page.locator(".zy-floating");
    await expect(card).toBeVisible();
    await expect(card).not.toContainText("Why");
    await setSettings({ sites: { enabled: [SITE] }, languages: { enabled: ["ckb"] } });
    await page.bringToFront();
    await page.locator("#field").fill("Min tu dîtim. ");
    await page.waitForTimeout(600);
    await expect(page.locator(".zy-underline")).toHaveCount(0);
  });

  test("speaks the interface language in its card", async () => {
    const page = await openSite({ interface: { uiLang: "ckb" } });
    await page.locator("#field").pressSequentially("Min tu dîtim.");
    await hoverFirstUnderline(page);
    const card = page.locator(".zy-floating section");
    await expect(card).toHaveAttribute("dir", "rtl");
    await expect(card).toHaveAttribute("lang", "ckb");
  });
});

test.describe("privacy", () => {
  test("no request leaves the browser while checking, suggesting and reading lessons", async () => {
    const outside: string[] = [];
    context.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith("chrome-extension://") && !url.startsWith(SITE) && !url.startsWith("data:"))
        outside.push(url);
    });
    const page = await openSite();
    await page.locator("#field").pressSequentially("Min tu dîtim. kit");
    await page.waitForTimeout(600);
    const app = await context.newPage();
    await app.goto(extensionUrl("app.html#/learn/kmr/14"));
    await expect(app.getByRole("heading", { level: 1 })).toBeVisible();
    await app.goto(extensionUrl("options.html"));
    await app.goto(extensionUrl("popup.html"));
    await app.waitForTimeout(300);
    expect(outside).toEqual([]);
  });

  test("no network code in the extension but the fetch of its own lexicons", () => {
    const files: string[] = [];
    const walk = (folder: string) => {
      for (const name of readdirSync(folder)) {
        const path = join(folder, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (path.endsWith(".js")) files.push(path);
      }
    };
    walk(BUILD);
    const found = files.flatMap((file) => {
      const code = readFileSync(file, "utf8");
      const hits = code.match(/\b(?:XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/g) ?? [];
      const fetches = (code.match(/\bfetch\(/g) ?? []).length;
      const name = relative(BUILD, file);
      return [
        ...hits.map((hit) => `${name}: ${hit}`),
        ...(name !== "background.js" && fetches > 0 ? [`${name}: fetch`] : []),
      ];
    });
    expect(found).toEqual([]);
  });

  test("the manifest asks for what the store listing explains, and hosts only on request", () => {
    const build = resolve(ROOT, "apps/extension/wxt.config.ts");
    expect(existsSync(build)).toBe(true);
    const manifest = JSON.parse(readFileSync(join(BUILD, "manifest.json"), "utf8")) as {
      permissions: string[];
      optional_host_permissions: string[];
      content_security_policy: { extension_pages: string };
      content_scripts?: unknown;
    };
    expect(manifest.permissions.sort()).toEqual([
      "activeTab",
      "contextMenus",
      "scripting",
      "sidePanel",
      "storage",
    ]);
    expect(manifest.optional_host_permissions).toEqual(["<all_urls>"]);
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.content_security_policy.extension_pages).toContain("connect-src 'self'");
    expect(manifest.content_security_policy.extension_pages).not.toContain("unsafe-eval");
  });
});

test.describe("extension pages", () => {
  async function seriousViolations(page: Page) {
    // The extension's own policy refuses a script tag, as it should. Evaluating goes around a policy.
    await page.evaluate(AXE);
    return page.evaluate(async () => {
      const results = await (
        window as unknown as {
          axe: {
            run(): Promise<{ violations: { id: string; impact: string; nodes: { target: unknown }[] }[] }>;
          };
        }
      ).axe.run();
      return results.violations
        .filter((found) => found.impact === "serious" || found.impact === "critical")
        .map((found) => `${found.id}: ${JSON.stringify(found.nodes.map((node) => node.target).slice(0, 3))}`);
    });
  }

  for (const uiLang of ["en", "ckb", "kmr"]) {
    for (const theme of ["light", "dark"]) {
      test(`have no serious accessibility problems (${uiLang}, ${theme})`, async () => {
        test.setTimeout(60_000);
        await setSettings({ interface: { uiLang, theme } });
        const page = await context.newPage();
        for (const path of [
          "popup.html",
          "options.html",
          "app.html#/check",
          "app.html#/learn/kmr/14",
          "app.html#/verbs",
          "app.html#/tools",
        ]) {
          await page.goto(extensionUrl(path));
          await page.waitForSelector("main");
          await page.waitForTimeout(250);
          // addScriptTag is refused by the extension's own policy, so axe goes in through the page's evaluate.
          expect([
            path,
            await seriousViolations(page).catch((error: Error) => [`axe: ${error.message.slice(0, 80)}`]),
          ]).toEqual([path, []]);
        }
        await expect(page.locator("html")).toHaveAttribute("dir", uiLang === "ckb" ? "rtl" : "ltr");
      });
    }
  }

  test("the popup fits, and offers what it promises", async () => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 380, height: 600 });
    await page.goto(extensionUrl("popup.html"));
    await expect(page.getByRole("button", { name: "Open the full app" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("textbox")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
  });

  test("settings save, and search finds a section", async () => {
    const page = await context.newPage();
    await page.goto(extensionUrl("options.html"));
    await page.getByRole("checkbox", { name: /Link findings/ }).uncheck();
    await expect
      .poll(() =>
        page.evaluate(
          async () => (await chrome.storage.local.get("settings"))["settings"]?.teaching?.lessonLinks,
        ),
      )
      .toBe(false);
    await page.getByRole("searchbox").fill("dictionary");
    await expect(page.getByRole("heading", { name: "Personal dictionary" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sites" })).toHaveCount(0);
    await page.getByRole("searchbox").fill("");
    await page.getByRole("textbox", { name: "Add a word" }).fill("Zimanyar");
    await page.getByRole("button", { name: "Add a word" }).click();
    await expect(page.getByRole("button", { name: "Remove Zimanyar" })).toBeVisible();
  });

  test("the verb explorer and the tools work from the engine", async () => {
    const page = await context.newPage();
    await page.goto(extensionUrl("app.html#/verbs"));
    await expect(page.getByRole("heading", { name: "Simple past" })).toBeVisible();
    await page.goto(extensionUrl("app.html#/tools"));
    await page.getByRole("textbox").fill("پیاوەکە هات");
    await expect(page.getByText("pyaweke hat")).toBeVisible();
  });

  test("the lesson reader goes between lessons, and keeps the link inside the reader", async () => {
    const page = await context.newPage();
    await page.goto(extensionUrl("app.html#/learn/ckb/7"));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Nouns");
    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/#\/learn\/ckb\/8$/);
    await page.goto(extensionUrl("app.html#/learn/kmr"));
    await page.getByRole("link", { name: /1\. Welcome to Kurmanji/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kurmanji");
  });
});

test("screenshots of the extension", async () => {
  test.skip(!UPDATE, "only when regenerating");
  test.setTimeout(90_000);
  const shoot = (page: Page, name: string) =>
    page.screenshot({ path: resolve(ROOT, `assets/screenshots/${name}.png`) });
  const site = await openSite();
  await site.setViewportSize({ width: 1100, height: 720 });
  await site.locator("#field").pressSequentially("Min tu dîtim.");
  await hoverFirstUnderline(site);
  await site.locator(".zy-floating").waitFor();
  await shoot(site, "extension-card");
  await site.locator("#field").fill("");
  await site.locator("#field").pressSequentially("دەرگاەکە کرایەوە");
  await site.waitForTimeout(300);
  await site.keyboard.press("Escape");
  await hoverFirstUnderline(site);
  await site.locator(".zy-floating section").waitFor();
  await shoot(site, "extension-card-ckb");
  const page = await context.newPage();
  await page.setViewportSize({ width: 380, height: 600 });
  await page.goto(extensionUrl("popup.html"));
  await page.waitForTimeout(300);
  await shoot(page, "extension-popup");
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto(extensionUrl("options.html"));
  await page.waitForTimeout(200);
  await shoot(page, "extension-settings");
  await page.goto(extensionUrl("app.html#/check"));
  await page.waitForTimeout(800);
  await shoot(page, "extension-full");
  await page.goto(extensionUrl("app.html#/learn/kmr/14"));
  await page.waitForTimeout(400);
  await shoot(page, "extension-lesson");
  await page.goto(extensionUrl("app.html#/verbs"));
  await page.waitForTimeout(400);
  await shoot(page, "extension-verbs");
  await page.setViewportSize({ width: 420, height: 760 });
  await page.goto(extensionUrl("sidepanel.html"));
  await page.waitForTimeout(800);
  await shoot(page, "extension-sidepanel");
});
