/// <reference path="../../packages/editor/demo/globals.d.ts" />
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const AXE = readFileSync(resolve(ROOT, "node_modules/axe-core/axe.min.js"), "utf8");
const UPDATE = Boolean(process.env["UPDATE_SCREENSHOTS"]);
const DEMO = "http://localhost:4174";

type FieldName = "textarea" | "editable" | "input";
const FIELDS: FieldName[] = ["textarea", "editable", "input"];

async function open(page: Page, lang = "kmr", theme = "light", extra = "") {
  await page.goto(`${DEMO}/?lang=${lang}&theme=${theme}${extra}`);
  await page.waitForFunction(() => window.editors?.["input"] !== undefined);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => (window.editors["textarea"]?.findings().length ?? 0) > 0);
}

/** One line's underlines relative to their field, read from inside the field's shadow root. */
const underlines = (page: Page, name: FieldName) =>
  page.evaluate(
    ([field, index]) => {
      const hosts = [...document.documentElement.children].filter((child) => child.shadowRoot);
      const box = (document.getElementById(field as string) as HTMLElement).getBoundingClientRect();
      const lines = hosts[index as number]?.shadowRoot?.querySelectorAll(".zy-underline") ?? [];
      return [...lines].map((line) => {
        const rect = line.getBoundingClientRect();
        return {
          left: rect.left - box.left,
          top: rect.top - box.top,
          width: rect.width,
          kind: line.className,
          id: (line as HTMLElement).dataset["finding"],
        };
      });
    },
    [name, FIELDS.indexOf(name)],
  );

const shadowOf = (page: Page, name: FieldName) => page.locator(`html > div`).nth(FIELDS.indexOf(name));

const contentOf = (page: Page, name: FieldName) =>
  page.evaluate((field) => {
    const element = document.getElementById(field) as HTMLTextAreaElement;
    return element.value ?? element.textContent;
  }, name);

for (const lang of ["kmr", "ckb"]) {
  test(`underlines in a textarea line up with the same text in the page (${lang})`, async ({ page }) => {
    await open(page, lang);
    const textarea = await underlines(page, "textarea");
    const editable = await underlines(page, "editable");
    expect(textarea.length).toBeGreaterThan(0);
    expect(textarea.length).toBe(editable.length);
    textarea.forEach((line, index) => {
      const other = editable[index];
      expect(Math.abs(line.left - (other?.left ?? 0))).toBeLessThan(2);
      expect(Math.abs(line.top - (other?.top ?? 0))).toBeLessThan(2);
      expect(Math.abs(line.width - (other?.width ?? 0))).toBeLessThan(2);
      expect(line.width).toBeGreaterThan(0);
    });
  });

  for (const name of FIELDS) {
    test(`underlines fall inside the ${name} (${lang})`, async ({ page }) => {
      await open(page, lang);
      const box = await page.locator(`#${name}`).boundingBox();
      const lines = await underlines(page, name);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.left).toBeGreaterThanOrEqual(0);
        expect(line.top).toBeGreaterThan(0);
        expect(line.left + line.width).toBeLessThanOrEqual((box?.width ?? 0) + 1);
      }
    });
  }
}

for (const lang of ["kmr", "ckb"]) {
  test(`the badge sits inside its field, and the card lines up with the word (${lang})`, async ({ page }) => {
    await open(page, lang);
    const box = await page.locator("#textarea").boundingBox();
    const shadow = shadowOf(page, "textarea");
    const badge = await shadow.locator(".zy-badge").boundingBox();
    expect(badge?.x).toBeGreaterThanOrEqual(box?.x ?? 0);
    expect((badge?.x ?? 0) + (badge?.width ?? 0)).toBeLessThanOrEqual((box?.x ?? 0) + (box?.width ?? 0));
    await page.evaluate(() => {
      const editor = window.editors["textarea"];
      editor?.open(editor.findings()[0]?.id ?? "");
    });
    const card = await shadow.locator(".zy-floating").boundingBox();
    const line = (await underlines(page, "textarea"))[0];
    const wordLeft = (box?.x ?? 0) + (line?.left ?? 0);
    const distance =
      lang === "ckb"
        ? Math.abs((card?.x ?? 0) + (card?.width ?? 0) - (wordLeft + (line?.width ?? 0)))
        : Math.abs((card?.x ?? 0) - wordLeft);
    expect(distance).toBeLessThan(2);
  });
}

test("the card uses the bundled fonts, not the browser's default", async ({ page }) => {
  await open(page, "kmr");
  await page.evaluate(() => {
    const editor = window.editors["textarea"];
    editor?.open(editor.findings()[0]?.id ?? "");
  });
  const family = await shadowOf(page, "textarea")
    .locator(".zy-floating")
    .evaluate((element) => getComputedStyle(element).fontFamily);
  expect(family).toContain("IBM Plex Sans");
});

test("the browser's spellchecker does not underline the text as well", async ({ page }) => {
  await open(page, "kmr");
  for (const name of FIELDS) {
    await expect(page.locator(`#${name}`)).toHaveAttribute("spellcheck", "false");
  }
});

test("a page cannot reach into the overlay", async ({ page }) => {
  await open(page, "kmr", "light", "&shadow=closed");
  const reachable = await page.evaluate(
    () => [...document.documentElement.children].filter((child) => child.shadowRoot).length,
  );
  expect(reachable).toBe(0);
  expect(await page.locator("html > div").count()).toBe(3);
});

for (const lang of ["en", "kmr", "ckb"]) {
  for (const theme of ["light", "dark"]) {
    test(`no serious accessibility problems with a card open (${lang}, ${theme})`, async ({ page }) => {
      await open(page, lang, theme);
      await page.evaluate(() => {
        const editor = window.editors["textarea"];
        editor?.open(editor.findings()[0]?.id ?? "");
      });
      await page.addScriptTag({ content: AXE });
      const violations = await page.evaluate(async () => {
        const results = await (
          window as unknown as {
            axe: { run(): Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> };
          }
        ).axe.run();
        return results.violations
          .filter((found) => found.impact === "serious" || found.impact === "critical")
          .map((found) => `${found.id}: ${JSON.stringify(found.nodes).slice(0, 300)}`);
      });
      expect(violations).toEqual([]);
    });
  }
}

test("a suggestion replaces the word, keeps the caret, and undo brings it back", async ({ page }) => {
  await open(page, "kmr");
  const before = await contentOf(page, "textarea");
  const field = page.locator("#textarea");
  await field.focus();
  await page.evaluate(() => {
    const element = document.getElementById("textarea") as HTMLTextAreaElement;
    element.setSelectionRange(element.value.length, element.value.length);
    const editor = window.editors["textarea"];
    const finding = editor?.findings().find((found) => found.suggestions.length > 0);
    editor?.apply(finding?.id ?? "", finding?.suggestions[0]?.text ?? "");
  });
  const after = await contentOf(page, "textarea");
  expect(after).not.toBe(before);
  const caret = await page.evaluate(
    () => (document.getElementById("textarea") as HTMLTextAreaElement).selectionStart,
  );
  expect(caret).toBe(after?.length);
  await page.keyboard.press("Control+z");
  expect(await contentOf(page, "textarea")).toBe(before);
});

test("a suggestion works in a contenteditable element, with undo", async ({ page }) => {
  await open(page, "kmr");
  const before = await contentOf(page, "editable");
  await page.locator("#editable").focus();
  await page.evaluate(() => {
    const editor = window.editors["editable"];
    const finding = editor?.findings().find((found) => found.suggestions.length > 0);
    editor?.apply(finding?.id ?? "", finding?.suggestions[0]?.text ?? "");
  });
  expect(await contentOf(page, "editable")).not.toBe(before);
  await page.keyboard.press("Control+z");
  expect(await contentOf(page, "editable")).toBe(before);
});

test("clicking an underline opens the card, and its button applies the fix", async ({ page }) => {
  await open(page, "en");
  const id = await page.evaluate(
    () => window.editors["textarea"]?.findings().find((found) => found.suggestions.length > 0)?.id,
  );
  const line = (await underlines(page, "textarea")).find((found) => found.id === id);
  const box = await page.locator("#textarea").boundingBox();
  const before = await contentOf(page, "textarea");
  await page.mouse.click(
    (box?.x ?? 0) + (line?.left ?? 0) + (line?.width ?? 0) / 2,
    (box?.y ?? 0) + (line?.top ?? 0) - 6,
  );
  const card = shadowOf(page, "textarea").locator(".zy-floating");
  await expect(card).toBeVisible();
  await expect(page.locator("#textarea")).toBeFocused();
  await card
    .getByRole("button", { name: /replace with/i })
    .first()
    .click();
  await expect(card).toBeHidden();
  expect(await contentOf(page, "textarea")).not.toBe(before);
});

test("the keyboard reaches the card and comes back", async ({ page }) => {
  await open(page, "kmr");
  await page.locator("#textarea").focus();
  await page.keyboard.press("Alt+Enter");
  const card = shadowOf(page, "textarea").locator(".zy-floating");
  await expect(card).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await expect(page.locator("#textarea")).toBeFocused();
});

for (const name of ["textarea", "editable"] as const) {
  test(`autocomplete in a ${name} leaves focus in the text`, async ({ page }) => {
    await open(page, "kmr");
    const field = page.locator(`#${name}`);
    await field.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" kit");
    const list = shadowOf(page, name).getByRole("listbox");
    await expect(list).toBeVisible();
    await expect(field).toBeFocused();
    const fieldBox = await field.boundingBox();
    const listBox = await list.boundingBox();
    expect(listBox?.y).toBeGreaterThan(fieldBox?.y ?? 0);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await expect(list).toBeHidden();
    expect(await contentOf(page, name)).toMatch(/ kitêba$/);
    await page.keyboard.type("x");
    expect(await contentOf(page, name)).toMatch(/ kitêbax$/);
  });
}

test("underlines follow the text when it scrolls, and stay inside the field", async ({ page }) => {
  await open(page, "kmr");
  await page.evaluate(() => {
    const element = document.getElementById("textarea") as HTMLTextAreaElement;
    element.rows = 2;
    element.value = `${"Rêzek.\n".repeat(10)}Ez ez hatim.`;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(() => window.editors["textarea"]?.findings().length === 1);
  const before = (await underlines(page, "textarea"))[0];
  await page.evaluate(() => {
    const element = document.getElementById("textarea") as HTMLTextAreaElement;
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(async () => (await underlines(page, "textarea"))[0]?.top).toBeLessThan(before?.top ?? 0);
});

test("the text keeps its underlines through typing elsewhere", async ({ page }) => {
  await open(page, "kmr");
  const count = (await underlines(page, "textarea")).length;
  await page.locator("#textarea").focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" a");
  expect((await underlines(page, "textarea")).length).toBeGreaterThanOrEqual(count - 1);
});

test("a phone screen does not scroll sideways, and the card fits", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page, "ckb");
  await page.evaluate(() => {
    const editor = window.editors["textarea"];
    editor?.open(editor.findings()[0]?.id ?? "");
  });
  const card = await shadowOf(page, "textarea").locator(".zy-floating").boundingBox();
  expect(card?.x).toBeGreaterThanOrEqual(0);
  expect((card?.x ?? 0) + (card?.width ?? 0)).toBeLessThanOrEqual(320);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(320);
});

test("nothing is requested from anywhere else", async ({ page }) => {
  const outside: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(DEMO) && !request.url().startsWith("data:")) outside.push(request.url());
  });
  await open(page, "kmr");
  await page.locator("#textarea").focus();
  await page.keyboard.type("kit");
  expect(outside).toEqual([]);
});

test("screenshots of the editor", async ({ page }) => {
  test.skip(!UPDATE, "only when regenerating");
  for (const [lang, theme] of [
    ["ckb", "light"],
    ["kmr", "light"],
    ["en", "dark"],
  ] as const) {
    await page.setViewportSize({ width: 900, height: 760 });
    await open(page, lang, theme);
    await page.evaluate(() => {
      const editor = window.editors["textarea"];
      editor?.open(editor.findings()[0]?.id ?? "");
    });
    await page.waitForTimeout(100);
    await page.screenshot({ path: resolve(ROOT, `assets/screenshots/editor-${lang}-${theme}.png`) });
  }
  await page.setViewportSize({ width: 900, height: 760 });
  await open(page, "kmr", "light");
  await page.locator("#textarea").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" kit");
  await shadowOf(page, "textarea").getByRole("listbox").waitFor();
  await page.keyboard.press("ArrowDown");
  await page.screenshot({ path: resolve(ROOT, "assets/screenshots/editor-autocomplete.png") });
});
