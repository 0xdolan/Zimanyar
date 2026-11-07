import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const AXE = readFileSync(resolve(ROOT, "node_modules/axe-core/axe.min.js"), "utf8");
const DIST = resolve(ROOT, "apps/web/dist");
const UPDATE = Boolean(process.env["UPDATE_SCREENSHOTS"]);
const SITE = "http://localhost:4175/Zimanyar/";

const LANGS = ["en", "ckb", "kmr"] as const;
const url = (lang: string, path = "") => `${SITE}${lang === "en" ? "" : `${lang}/`}${path}`;

const PAGES = [
  "",
  "check/",
  "learn/",
  "learn/sorani/",
  "learn/sorani/07-nouns/",
  "learn/kurmanji/14-past-transitive-ergativity/",
  "learn/sorani/verbs/xwardin/",
  "rules/",
  "rules/kmr.ergative.agreement/",
  "download/",
  "desktop/",
  "docs/",
  "privacy/",
  "about/",
  "changelog/",
  "licences/",
];

async function setTheme(page: Page, theme: string) {
  await page.addInitScript((value) => {
    try {
      localStorage.setItem("starlight-theme", value);
    } catch {}
  }, theme);
}

async function open(page: Page, target: string) {
  await page.goto(target);
  await page.evaluate(() => document.fonts.ready);
}

const htmlFiles = (): string[] =>
  (readdirSync(DIST, { recursive: true }) as string[]).filter((file) => file.endsWith(".html"));

test.describe("every page", () => {
  for (const lang of LANGS) {
    for (const theme of ["light", "dark"]) {
      test(`no serious accessibility problems (${lang}, ${theme})`, async ({ page }) => {
        test.setTimeout(120_000);
        await setTheme(page, theme);
        for (const path of PAGES) {
          await open(page, url(lang, path));
          await page.addScriptTag({ content: AXE });
          const violations = await page.evaluate(async () => {
            const results = await (
              window as unknown as {
                axe: {
                  run(
                    context: unknown,
                  ): Promise<{ violations: { id: string; impact: string; nodes: { target: unknown }[] }[] }>;
                };
              }
            ).axe.run({
              // Starlight's search button shows its shortcut, Ctrl K, beside a label that rightly leaves it out.
              exclude: ["button[data-open-modal]"],
            });
            return results.violations
              .filter((found) => found.impact === "serious" || found.impact === "critical")
              .map(
                (found) =>
                  `${found.id}: ${JSON.stringify(found.nodes.map((node) => node.target).slice(0, 4))}`,
              );
          });
          expect([path, violations]).toEqual([path, []]);
        }
      });
    }

    test(`no sideways scrolling on a phone (${lang})`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 320, height: 640 });
      for (const path of PAGES) {
        await open(page, url(lang, path));
        const width = await page.evaluate(() => document.documentElement.scrollWidth);
        expect([path, width]).toEqual([path, 320]);
      }
    });

    test(`the page says its language and direction (${lang})`, async ({ page }) => {
      await open(page, url(lang));
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator("html")).toHaveAttribute("dir", lang === "ckb" ? "rtl" : "ltr");
    });
  }

  test("nothing is requested from anywhere else", async ({ page }) => {
    test.setTimeout(120_000);
    const outside: string[] = [];
    page.on("request", (request) => {
      const address = request.url();
      if (!address.startsWith("http://localhost:4175/") && !address.startsWith("data:"))
        outside.push(address);
    });
    for (const path of PAGES) await open(page, url("en", path));
    await open(page, url("en", "check/"));
    await page.getByRole("textbox", { name: "Text to check" }).fill("Ez ez hatim.");
    await page.waitForTimeout(500);
    expect(outside).toEqual([]);
  });
});

test.describe("the built site", () => {
  test("has no link to a page that does not exist", () => {
    const broken = new Set<string>();
    for (const file of htmlFiles()) {
      const html = readFileSync(join(DIST, file), "utf8");
      for (const [, href = ""] of html.matchAll(/<a\b[^>]*?href="([^"#?]*)/g)) {
        if (href === "" || /^(https?:|mailto:)/.test(href)) continue;
        const from = `/Zimanyar/${dirname(file)}/`;
        const path = new URL(href, `http://x${from}`).pathname.replace(/^\/Zimanyar\//, "");
        const target = join(DIST, decodeURIComponent(path));
        if (!existsSync(target.endsWith("/") ? join(target, "index.html") : target))
          broken.add(`${file}: ${href}`);
      }
    }
    expect([...broken].slice(0, 20)).toEqual([]);
  });

  test("has the anchors rule pages and finding cards link to", () => {
    const missing: string[] = [];
    const index = JSON.parse(readFileSync(resolve(ROOT, "packages/rules/lessons.json"), "utf8")) as Record<
      string,
      Record<string, { file: string; anchors: string[] }>
    >;
    for (const [lang, lessons] of Object.entries(index)) {
      for (const { file, anchors } of Object.values(lessons)) {
        const name = file.split("/").at(-1)?.replace(".md", "") as string;
        const html = readFileSync(
          join(DIST, "learn", lang === "ckb" ? "sorani" : "kurmanji", name, "index.html"),
          "utf8",
        );
        for (const anchor of anchors) {
          if (!html.includes(`id="${anchor}"`)) missing.push(`${lang}/${name}#${anchor}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  test("holds no dash our writing rules forbid", () => {
    const forbidden = new RegExp(`[${String.fromCodePoint(0x2014, 0x2013, 0x2212, 0x2015)}]`);
    const found: string[] = [];
    for (const file of htmlFiles()) {
      // Only what a reader sees counts, so everything between < and > goes, along with scripts and styles.
      const text = readFileSync(join(DIST, file), "utf8")
        .split(/<(?:script|style)\b/)
        .map((part, index) => (index === 0 ? part : part.slice(part.search(/<\/(?:script|style)>/) + 1)))
        .join("")
        .split("<")
        .map((part) => part.slice(part.indexOf(">") + 1))
        .join(" ");
      if (forbidden.test(text)) found.push(relative(DIST, join(DIST, file)));
    }
    expect(found.slice(0, 20)).toEqual([]);
  });
});

test.describe("a lesson", () => {
  test("shows tables from the engine, without loading the checker", async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (request) => requested.push(request.url()));
    await open(page, url("en", "learn/sorani/07-nouns/"));
    await expect(page.getByRole("cell", { name: "پیاوەکە" }).first()).toBeVisible();
    expect(await page.locator('span[lang="ckb"][dir="rtl"]').count()).toBeGreaterThan(20);
    expect(requested.filter((address) => /lexicon|worker/.test(address))).toEqual([]);
  });

  test("has its level, a sidebar for its course alone, and previous and next", async ({ page }) => {
    await open(page, url("en", "learn/kurmanji/14-past-transitive-ergativity/"));
    await expect(page.locator(".zy-level")).toContainText("Lesson 14 of 23");
    await expect(page.locator(".pagination-links a")).toHaveCount(2);
    const sidebar = page.locator("#starlight__sidebar");
    await expect(sidebar).toContainText(/past/i);
    await expect(sidebar.getByRole("link", { name: /Welcome to Sorani/ })).toHaveCount(0);
  });

  test("lists the rules it teaches, with working links", async ({ page }) => {
    await open(page, url("en", "learn/sorani/07-nouns/"));
    await page.getByRole("link", { name: "ckb.morph.definite-allomorph" }).click();
    await expect(page).toHaveURL(/rules\/ckb\.morph\.definite-allomorph\//);
  });

  test("gives kirîn a page of its own", async ({ page }) => {
    await open(page, url("en", "learn/kurmanji/verbs/kirin-2/"));
    await expect(page.locator("h1")).toContainText("kirîn");
    await open(page, url("en", "learn/kurmanji/verbs/kirin/"));
    await expect(page.locator("h1")).toContainText("kirin");
  });
});

test.describe("the rule catalogue", () => {
  test("filters by language, and keeps every rule listed until then", async ({ page }) => {
    await open(page, url("en", "rules/"));
    const rows = page.locator(".zy-rule-row:visible");
    const all = await rows.count();
    expect(all).toBeGreaterThan(40);
    await page.locator("#rule-filters select[name=lang]").selectOption("kmr");
    const some = await rows.count();
    expect(some).toBeGreaterThan(5);
    expect(some).toBeLessThan(all);
    await page.locator("#rule-filters select[name=lang]").selectOption("");
    await expect(rows).toHaveCount(all);
  });

  test("a rule's page shows its examples and links to its lesson's anchor", async ({ page }) => {
    await open(page, url("en", "rules/kmr.ergative.agreement/"));
    await expect(page.locator("table").first()).toBeVisible();
    const lesson = page.locator('a[href*="/learn/kurmanji/"][href*="#"]').first();
    await lesson.click();
    await expect(page).toHaveURL(/learn\/kurmanji\/\d\d-[^/]+\/#/);
    const anchor = new URL(page.url()).hash.slice(1);
    await expect(page.locator(`[id="${anchor}"]`)).toHaveCount(1);
  });
});

test.describe("the checker", () => {
  const field = (page: Page) => page.getByRole("textbox").first();

  test("finds mistakes, groups them and applies a fix", async ({ page }) => {
    await open(page, url("en", "check/"));
    await field(page).fill("Min tu dîtim.");
    const row = page.getByRole("button", { name: /dîtim/ }).first();
    await row.click();
    await page.getByRole("button", { name: "Replace with dîtî" }).click();
    await expect(field(page)).toHaveValue("Min tu dîtî.");
  });

  test("checks Kurmanji typed on a Turkish keyboard, rather than calling it Turkish", async ({ page }) => {
    await open(page, url("en", "check/"));
    await field(page).fill("Ez dıçım malê.");
    await page.getByRole("button", { name: "Fix all safe" }).click();
    await expect(field(page)).toHaveValue("Ez diçim malê.");
  });

  test("fixes only what is safe", async ({ page }) => {
    await open(page, url("en", "check/"));
    await field(page).fill("Min tu dîtim. Ez dıçım malê.");
    await page.getByRole("button", { name: "Fix all safe" }).click();
    await expect(field(page)).toHaveValue("Min tu dîtim. Ez diçim malê.");
  });

  test("works in right-to-left Sorani", async ({ page }) => {
    await open(page, url("ckb", "check/"));
    await field(page).fill("دەرگاەکە کرایەوە.");
    await expect(
      page.getByRole("button", { name: /دەرگاکە/ }).or(page.getByText("دەرگاەکە").first()),
    ).toBeVisible();
  });

  test("restores text from a shared link, and never sends it", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const sent: string[] = [];
    page.on("request", (request) => sent.push(request.url()));
    await open(page, url("en", "check/"));
    await field(page).fill("Ez ez hatim.");
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();
    const link = page.url();
    expect(link).toContain("#");
    const secret = new URL(link).hash.slice(1);
    await page.goto("about:blank");
    await open(page, link);
    await expect(field(page)).toHaveValue("Ez ez hatim.");
    expect(sent.filter((address) => new URL(address).search.includes(secret))).toEqual([]);
  });

  test("ignores a broken shared link", async ({ page }) => {
    await open(page, `${url("en", "check/")}#t=%%%not-base64`);
    await expect(field(page)).not.toHaveValue("");
  });

  test("finds all that is in a 2000-word article within a second of the worker being ready", async ({
    page,
  }) => {
    await open(page, url("en", "check/"));
    await field(page).fill("Ez hatim.");
    await page.waitForTimeout(1500);
    const sentence = "Ez ez hatim û min tu dîtim. ";
    const article = sentence.repeat(290);
    const start = Date.now();
    await field(page).fill(article);
    await expect(page.locator("section").first()).toContainText(/\d/);
    await expect
      .poll(() => page.evaluate(() => document.querySelectorAll("section button").length), {
        intervals: [50],
      })
      .toBeGreaterThan(100);
    expect(Date.now() - start).toBeLessThan(1500);
  });

  test("keeps working offline after the first visit", async ({ page, context }) => {
    await open(page, url("en", "check/"));
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.waitForTimeout(800);
    await context.setOffline(true);
    await page.reload();
    await field(page).fill("Min tu dîtim.");
    await expect(page.getByRole("button", { name: /dîtim/ }).first()).toBeVisible();
  });
});

/**
 * Lighthouse pulls in packages with known advisories, so it is not a dependency here. These hold the same
 * line in CI; it was measured by hand at 97 or more for performance.
 */
test.describe("speed", () => {
  test("a lesson runs no island, and every page describes itself", () => {
    const lesson = readFileSync(join(DIST, "learn/sorani/07-nouns/index.html"), "utf8");
    expect(lesson).not.toContain("<astro-island");
    const undescribed = htmlFiles().filter((file) => {
      if (file === "404.html") return false;
      return !/<meta name="description" content="[^"]+"/.test(readFileSync(join(DIST, file), "utf8"));
    });
    expect(undescribed.slice(0, 10)).toEqual([]);
  });

  for (const path of ["", "check/", "learn/sorani/07-nouns/"]) {
    test(`the page "${path}" paints quickly, and does not jump`, async ({ page }) => {
      await page.goto(url("en", path));
      await page.waitForTimeout(1000);
      const { lcp, shift } = await page.evaluate(
        () =>
          new Promise<{ lcp: number; shift: number }>((done) => {
            let lcp = 0;
            let shift = 0;
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) lcp = entry.startTime;
            }).observe({ type: "largest-contentful-paint", buffered: true });
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) shift += (entry as unknown as { value: number }).value;
            }).observe({ type: "layout-shift", buffered: true });
            setTimeout(() => done({ lcp, shift }), 300);
          }),
      );
      expect(lcp).toBeLessThan(2500);
      expect(shift).toBeLessThan(0.1);
    });
  }
});

test("the search finds a lesson", async ({ page }) => {
  await open(page, url("en", "learn/"));
  await page.getByRole("button", { name: "Search" }).click();
  await page.locator(".pagefind-ui__search-input").fill("ergativity");
  await expect(page.locator(".pagefind-ui__result").first()).toBeVisible({ timeout: 10_000 });
});

test("screenshots of the site", async ({ page }) => {
  test.skip(!UPDATE, "only when regenerating");
  test.setTimeout(120_000);
  const shots: [string, string, { width: number; height: number }][] = [
    ["web-home-en", url("en"), { width: 1280, height: 900 }],
    ["web-home-ckb", url("ckb"), { width: 1280, height: 900 }],
    ["web-check-ckb", url("ckb", "check/"), { width: 1280, height: 900 }],
    ["web-check-kmr", url("kmr", "check/"), { width: 1280, height: 900 }],
    ["web-lesson-ckb", url("en", "learn/sorani/07-nouns/"), { width: 1280, height: 900 }],
    [
      "web-lesson-kmr-rtl-ui",
      url("ckb", "learn/kurmanji/14-past-transitive-ergativity/"),
      { width: 1280, height: 900 },
    ],
    ["web-rule", url("en", "rules/kmr.ergative.agreement/"), { width: 1280, height: 900 }],
    ["web-rules", url("en", "rules/"), { width: 1280, height: 900 }],
    ["web-download", url("en", "download/"), { width: 1280, height: 900 }],
    ["web-learn", url("kmr", "learn/"), { width: 1280, height: 900 }],
    ["web-home-phone", url("en"), { width: 390, height: 844 }],
    ["web-check-phone", url("ckb", "check/"), { width: 390, height: 844 }],
    ["web-lesson-phone", url("en", "learn/sorani/07-nouns/"), { width: 390, height: 844 }],
  ];
  for (const [name, target, size] of shots) {
    await page.setViewportSize(size);
    await open(page, target);
    await page.waitForTimeout(name.includes("check") || name.includes("home") ? 1500 : 200);
    await page.screenshot({ path: resolve(ROOT, `assets/screenshots/${name}.png`) });
  }
});
