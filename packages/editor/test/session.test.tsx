import { Checker } from "@zimanyar/checker";
import type { Finding, LessonRef } from "@zimanyar/rules";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachEditor, type EditorBackend, type EditorHandle, type EditorOptions } from "../src/index.js";
import { addStyles, OVERLAY_CSS, splitStyles } from "../src/styles.js";

const checker = new Checker();
const TEXT = "Ez ez hatim .";

function backendOf(overrides: Partial<EditorBackend> = {}): EditorBackend {
  return {
    check: vi.fn(async (text, options) => checker.check(text, { lang: "kmr", ...options })),
    suggest: vi.fn(async () => ["mal", "mak"]),
    complete: vi.fn(async (prefix: string) =>
      ["kitêb", "kitêba", "kit"]
        .filter((word) => word.startsWith(prefix))
        .map((word) => ({ word, attested: true })),
    ),
    ...overrides,
  };
}

/** jsdom lays nothing out: each character is 10 pixels wide, on one line. */
function fakeLayout() {
  Range.prototype.getClientRects = function (this: Range) {
    const left = this.startOffset * 10;
    const right = this.endOffset * 10;
    return [{ left, right, top: 0, bottom: 20, width: right - left, height: 20 }] as unknown as DOMRectList;
  };
}

const open: EditorHandle[] = [];
let textarea: HTMLTextAreaElement;

function attach(options: Partial<EditorOptions> = {}, element: Element = textarea) {
  const backend = options.backend ?? backendOf();
  const handle = attachEditor(element, { uiLang: "en", shadow: "open", backend, ...options });
  if (handle === null) throw new Error("not attached");
  open.push(handle);
  const host = document.documentElement.lastElementChild as HTMLElement;
  return { handle, backend, shadow: host.shadowRoot as ShadowRoot, host };
}

const settled = (handle: EditorHandle) =>
  vi.waitFor(() => expect(handle.findings().length).toBeGreaterThan(0));

function type(text: string, caret = text.length) {
  textarea.focus();
  textarea.value = text;
  textarea.setSelectionRange(caret, caret);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

const press = (key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  textarea.dispatchEvent(event);
  return event;
};

const clickAt = (x: number, y: number) =>
  textarea.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
const hoverAt = (x: number, y: number) =>
  textarea.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: x, clientY: y }));

const words = (shadow: ShadowRoot) =>
  [...shadow.querySelectorAll('[role="option"]')].map((o) => o.textContent);

beforeEach(() => {
  fakeLayout();
  textarea = document.createElement("textarea");
  textarea.value = TEXT;
  document.body.append(textarea);
});

afterEach(() => {
  for (const handle of open.splice(0)) handle.destroy();
  textarea.remove();
  vi.useRealTimers();
});

describe("attaching", () => {
  it("refuses a field that may not be read, and adds nothing to the page", () => {
    const password = document.createElement("input");
    password.type = "password";
    const before = document.documentElement.childElementCount;
    expect(attachEditor(password, { backend: backendOf(), uiLang: "en" })).toBeNull();
    expect(document.documentElement.childElementCount).toBe(before);
  });

  it("uses a closed shadow root unless told otherwise", () => {
    const handle = attachEditor(textarea, { backend: backendOf(), uiLang: "en" }) as EditorHandle;
    open.push(handle);
    const host = document.documentElement.lastElementChild as HTMLElement;
    expect(host.shadowRoot).toBeNull();
  });

  it("sets the theme on its host", () => {
    expect(attach({ theme: "dark" }).host.dataset["theme"]).toBe("dark");
  });

  it("leaves the theme to the system by default", () => {
    expect(attach().host.dataset["theme"]).toBeUndefined();
  });

  it("removes everything when destroyed", async () => {
    const before = document.documentElement.childElementCount;
    const { handle } = attach();
    await settled(handle);
    open.pop();
    handle.destroy();
    expect(document.documentElement.childElementCount).toBe(before);
  });

  it("turns off the browser's spellchecker while attached, and restores it", () => {
    const { handle } = attach();
    expect(textarea.getAttribute("spellcheck")).toBe("false");
    open.pop();
    handle.destroy();
    expect(textarea.hasAttribute("spellcheck")).toBe(false);
    textarea.setAttribute("spellcheck", "true");
    const second = attach();
    open.pop();
    second.handle.destroy();
    expect(textarea.getAttribute("spellcheck")).toBe("true");
  });

  it("works on a contenteditable element", async () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    editable.textContent = TEXT;
    document.body.append(editable);
    const { handle, shadow } = attach({}, editable);
    await settled(handle);
    expect(shadow.querySelectorAll(".zy-underline").length).toBeGreaterThan(0);
    editable.textContent = "Ez hatim.";
    await vi.waitFor(() => expect(handle.findings()).toEqual([]));
    editable.remove();
  });
});

describe("underlines", () => {
  it("draws one for each finding, by kind, where the text is", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    const repeat = handle.findings().find((finding) => finding.ruleId === "any.repeat.word") as Finding;
    const line = shadow.querySelector(`[data-finding="${repeat.id}"]`) as HTMLElement;
    expect(line.style.left).toBe(`${repeat.range.start * 10}px`);
    expect(line.style.width).toBe(`${(repeat.range.end - repeat.range.start) * 10}px`);
    expect(line.className).toContain(`zy-${repeat.severity}`);
  });

  it("gives each kind its own shape, so colour is not the only difference", () => {
    for (const kind of ["error", "warning", "hint", "spelling"]) expect(OVERLAY_CSS).toContain(`.zy-${kind}`);
    expect(OVERLAY_CSS).toContain("dotted");
    expect(OVERLAY_CSS).toContain("dashed");
    expect(OVERLAY_CSS).toContain("solid");
    expect(OVERLAY_CSS).toContain("linear-gradient");
  });

  it("marks spelling findings with their own kind", async () => {
    const spelling = {
      ...checker.check(TEXT, { lang: "kmr" })[0],
      category: "spelling",
      severity: "error",
    } as Finding;
    const { handle, shadow } = attach({ backend: backendOf({ check: async () => [spelling] }) });
    await settled(handle);
    expect(shadow.querySelector(".zy-spelling")).not.toBeNull();
  });

  it("moves them with an edit before the next check answers", async () => {
    let answer: (found: Finding[]) => void = () => {};
    const backend = backendOf();
    const { handle, shadow } = attach({ backend });
    await settled(handle);
    backend.check = () => new Promise((resolve) => (answer = resolve));
    const before = handle.findings().at(-1) as Finding;
    type(`XX${TEXT}`, 2);
    expect(handle.findings().at(-1)?.range.start).toBe(before.range.start + 2);
    expect(shadow.querySelectorAll(".zy-underline").length).toBeGreaterThan(0);
    answer([]);
  });

  it("asks for checks without suggestions, and passes on the options", async () => {
    const backend = backendOf();
    attach({ backend, lang: "kmr", strictness: "tolerant", disabledRules: ["x"] });
    expect(backend.check).toHaveBeenCalledWith(TEXT, {
      deferSuggestions: true,
      lang: "kmr",
      strictness: "tolerant",
      disabledRules: ["x"],
    });
  });

  it("ignores an answer about text that has since changed", async () => {
    const answers: ((found: Finding[]) => void)[] = [];
    const backend = backendOf({ check: () => new Promise((resolve) => answers.push(resolve)) });
    const { handle } = attach({ backend });
    type("Ez hatim.");
    answers[0]?.(checker.check(TEXT, { lang: "kmr" }));
    await Promise.resolve();
    expect(handle.findings()).toEqual([]);
  });

  it("reports a failed check and keeps going", async () => {
    const onError = vi.fn();
    const backend = backendOf({ check: () => Promise.reject(new Error("worker gone")) });
    attach({ backend, onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
  });

  it("tells the page's listener about findings", async () => {
    const onFindings = vi.fn();
    const { handle } = attach({ onFindings });
    await settled(handle);
    expect(onFindings.mock.lastCall?.[0]).toEqual(handle.findings());
  });

  it("redraws when the page scrolls or resizes", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    const line = shadow.querySelector(".zy-underline") as HTMLElement;
    const box = vi.spyOn(textarea, "getBoundingClientRect");
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));
    await vi.waitFor(() => expect(box).toHaveBeenCalled());
    expect(line.isConnected).toBe(true);
  });

  it("checks again when refreshed, picking up a change made without an event", async () => {
    const { handle, backend } = attach();
    await settled(handle);
    textarea.value = "Ez hatim.";
    await handle.refresh();
    expect(backend.check).toHaveBeenLastCalledWith("Ez hatim.", expect.anything());
    expect(handle.findings()).toEqual([]);
  });
});

describe("the badge", () => {
  it("shows the count, with a full label, and opens the first finding", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    const badge = shadow.querySelector(".zy-badge") as HTMLButtonElement;
    const count = handle.findings().length;
    expect(badge.textContent).toBe(String(count));
    expect(badge.getAttribute("aria-label")).toContain(String(count));
    badge.click();
    expect(shadow.activeElement).not.toBeNull();
    expect(shadow.querySelector(".zy-floating")).not.toBeNull();
  });

  it("is absent when nothing is wrong, and says so to screen readers", async () => {
    textarea.value = "Ez hatim.";
    const { shadow } = attach();
    await Promise.resolve();
    expect(shadow.querySelector(".zy-badge")).toBeNull();
    expect(shadow.querySelector('[role="status"]')?.textContent).toBe("No findings");
  });

  it("uses the interface language's digits", async () => {
    const { handle, shadow } = attach({ uiLang: "ckb" });
    await settled(handle);
    expect(shadow.querySelector(".zy-badge")?.textContent).toMatch(/^[٠-٩]+$/);
  });
});

describe("the finding card", () => {
  const cardOf = (shadow: ShadowRoot) => shadow.querySelector(".zy-floating");
  const firstFinding = (handle: EditorHandle) => handle.findings()[0] as Finding;
  const button = (shadow: ShadowRoot, name: RegExp) =>
    [...shadow.querySelectorAll("button")].find((found) =>
      name.test(found.getAttribute("aria-label") ?? found.textContent ?? ""),
    ) as HTMLButtonElement;

  it("opens on click, leaving focus in the text", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    textarea.focus();
    clickAt(firstFinding(handle).range.start * 10 + 1, 10);
    expect(cardOf(shadow)).not.toBeNull();
    expect(document.activeElement).toBe(textarea);
  });

  it("closes on a click on nothing, or outside the field", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    handle.open(firstFinding(handle).id);
    clickAt(1000, 1000);
    expect(cardOf(shadow)).toBeNull();
    handle.open(firstFinding(handle).id);
    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(cardOf(shadow)).toBeNull();
  });

  it("stays open for a press inside it", async () => {
    const { handle, shadow, host } = attach();
    await settled(handle);
    handle.open(firstFinding(handle).id);
    host.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(cardOf(shadow)).not.toBeNull();
  });

  it("opens from hovering and closes when the pointer goes", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    hoverAt(firstFinding(handle).range.start * 10 + 1, 10);
    await vi.waitFor(() => expect(cardOf(shadow)).not.toBeNull());
    textarea.dispatchEvent(new MouseEvent("pointerleave"));
    await vi.waitFor(() => expect(cardOf(shadow)).toBeNull());
  });

  it("does not open if the pointer moves on before the pause ends", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    hoverAt(firstFinding(handle).range.start * 10 + 1, 10);
    hoverAt(1000, 1000);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(cardOf(shadow)).toBeNull();
  });

  it("stays while the pointer is on the card", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    hoverAt(firstFinding(handle).range.start * 10 + 1, 10);
    await vi.waitFor(() => expect(cardOf(shadow)).not.toBeNull());
    textarea.dispatchEvent(new MouseEvent("pointerleave"));
    cardOf(shadow)?.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(cardOf(shadow)).not.toBeNull();
    cardOf(shadow)?.dispatchEvent(new MouseEvent("pointerout", { bubbles: true }));
    await vi.waitFor(() => expect(cardOf(shadow)).toBeNull());
  });

  it("is not replaced by hovering over another word", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    const [first, second] = handle.findings() as [Finding, Finding];
    handle.open(first.id);
    hoverAt(second.range.start * 10 + 1, 10);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(cardOf(shadow)?.textContent).toContain("twice");
  });

  it("is keyboard reachable: Alt+Enter opens the finding at the caret and takes focus", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    textarea.focus();
    textarea.setSelectionRange(1, 1);
    const event = press("Enter", { altKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(shadow.activeElement).not.toBeNull();
    expect(cardOf(shadow)).not.toBeNull();
  });

  it("goes to the next finding when the caret is on none, and wraps around", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    textarea.focus();
    const after = (handle.findings().at(-1) as Finding).range.end + 0;
    textarea.setSelectionRange(after, after);
    press("Enter", { altKey: true });
    expect(cardOf(shadow)).not.toBeNull();
    press("Escape");
    textarea.setSelectionRange(TEXT.length, TEXT.length);
    press("Enter", { altKey: true });
    expect(cardOf(shadow)).not.toBeNull();
  });

  it("leaves Alt+Enter alone when nothing is wrong", async () => {
    textarea.value = "Ez hatim.";
    attach();
    await Promise.resolve();
    expect(press("Enter", { altKey: true }).defaultPrevented).toBe(false);
  });

  it("closes on Escape from the text", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    handle.open(firstFinding(handle).id);
    press("Escape");
    expect(cardOf(shadow)).toBeNull();
  });

  it("gives focus back to the text when its close button is used", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    handle.open(firstFinding(handle).id);
    button(shadow, /close/i).click();
    expect(cardOf(shadow)).toBeNull();
    expect(document.activeElement).toBe(textarea);
  });

  it("closes when the text changes", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    handle.open(firstFinding(handle).id);
    type(`${TEXT} x`);
    expect(cardOf(shadow)).toBeNull();
  });

  it("does nothing for a finding that is gone", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    handle.open("nope");
    handle.apply("nope", "x");
    expect(cardOf(shadow)).toBeNull();
    expect(textarea.value).toBe(TEXT);
  });

  it("applies a suggestion, and checks again", async () => {
    const { handle, backend, shadow } = attach();
    await settled(handle);
    const finding = firstFinding(handle);
    handle.open(finding.id);
    button(shadow, /replace with/i).click();
    expect(textarea.value).toBe(
      TEXT.slice(0, finding.range.start) + finding.suggestions[0]?.text + TEXT.slice(finding.range.end),
    );
    expect(cardOf(shadow)).toBeNull();
    await vi.waitFor(() => expect(backend.check).toHaveBeenLastCalledWith(textarea.value, expect.anything()));
  });

  it("ignores a finding for the session, and every like it", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    const finding = firstFinding(handle);
    handle.open(finding.id);
    button(shadow, /ignore/i).click();
    expect(handle.findings().map((found) => found.id)).not.toContain(finding.id);
    expect(cardOf(shadow)).toBeNull();
  });

  it("hands a word to the dictionary, and stops flagging it", async () => {
    const onAddToDictionary = vi.fn();
    const finding = { ...checker.check(TEXT, { lang: "kmr" })[0], category: "spelling" } as Finding;
    const { handle, shadow } = attach({
      onAddToDictionary,
      backend: backendOf({ check: async () => [finding] }),
    });
    await settled(handle);
    handle.open(finding.id);
    button(shadow, /dictionary/i).click();
    expect(onAddToDictionary).toHaveBeenCalledWith(TEXT.slice(finding.range.start, finding.range.end));
    expect(handle.findings().map((found) => found.id)).not.toContain(finding.id);
  });

  it("offers no dictionary without somewhere to put the word", async () => {
    const finding = { ...checker.check(TEXT, { lang: "kmr" })[0], category: "spelling" } as Finding;
    const { handle, shadow } = attach({ backend: backendOf({ check: async () => [finding] }) });
    await settled(handle);
    handle.open(finding.id);
    expect(button(shadow, /dictionary/i)).toBeUndefined();
  });

  it("opens a lesson and the pronunciation through the caller", async () => {
    const lesson: LessonRef = { lang: "kmr", lessonId: 1, anchor: "a", title: "t" };
    const onLearn = vi.fn();
    const finding = { ...checker.check(TEXT, { lang: "kmr" })[0], lessons: [lesson] } as Finding;
    const { handle, shadow } = attach({
      backend: backendOf({ check: async () => [finding] }),
      onLearn,
      ipaOf: () => "x",
    });
    await settled(handle);
    handle.open(finding.id);
    button(shadow, /learn|lesson/i)?.click();
    expect(cardOf(shadow)).not.toBeNull();
  });

  it("fetches deferred suggestions once, when the card opens", async () => {
    const finding = { ...checker.check(TEXT, { lang: "kmr" })[0], suggestions: [], lookup: "mak" } as Finding;
    const backend = backendOf({ check: async () => [finding] });
    const { handle, shadow } = attach({ backend });
    await settled(handle);
    handle.open(finding.id);
    await vi.waitFor(() => expect(button(shadow, /replace with mal/i)).toBeDefined());
    handle.open(finding.id);
    expect(backend.suggest).toHaveBeenCalledOnce();
    expect(backend.suggest).toHaveBeenCalledWith("mak", finding.lang === "any" ? "kmr" : finding.lang);
  });

  it("uses a finding's own language when it has one", async () => {
    const finding = {
      ...checker.check(TEXT, { lang: "kmr" })[0],
      lang: "ckb",
      suggestions: [],
      lookup: "mak",
    } as Finding;
    const backend = backendOf({ check: async () => [finding] });
    const { handle } = attach({ backend });
    await settled(handle);
    handle.open(finding.id);
    expect(backend.suggest).toHaveBeenCalledWith("mak", "ckb");
  });

  it("reports a failed lookup", async () => {
    const onError = vi.fn();
    const finding = { ...checker.check(TEXT, { lang: "kmr" })[0], suggestions: [], lookup: "mak" } as Finding;
    const backend = backendOf({
      check: async () => [finding],
      suggest: () => Promise.reject(new Error("no")),
    });
    const { handle } = attach({ backend, onError });
    await settled(handle);
    handle.open(finding.id);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
  });

  it("lines up with the side right-to-left text starts on", async () => {
    textarea.style.direction = "rtl";
    const { handle, shadow } = attach();
    await settled(handle);
    handle.open(firstFinding(handle).id);
    const floating = cardOf(shadow) as HTMLElement;
    expect(floating.style.right).not.toBe("");
    expect(floating.style.left).toBe("");
    const badge = shadow.querySelector(".zy-badge") as HTMLElement;
    expect(badge.style.left).not.toBe("");
    expect(badge.style.right).toBe("");
  });

  it("lines up with the left in left-to-right text", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    handle.open(firstFinding(handle).id);
    expect((cardOf(shadow) as HTMLElement).style.left).not.toBe("");
    expect((shadow.querySelector(".zy-badge") as HTMLElement).style.right).not.toBe("");
  });

  it("sits above the overlays of other fields while open", async () => {
    const { handle, host } = attach();
    await settled(handle);
    const closed = Number(host.style.zIndex);
    handle.open(firstFinding(handle).id);
    expect(Number(host.style.zIndex)).toBeGreaterThan(closed);
    press("Escape");
    expect(Number(host.style.zIndex)).toBe(closed);
  });

  it("scrolls inside the room it has", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    handle.open(firstFinding(handle).id);
    const room = Number.parseFloat((cardOf(shadow) as HTMLElement).style.maxHeight);
    expect(room).toBeGreaterThan(0);
    expect(room).toBeLessThan(window.innerHeight);
  });

  it("opens above the text when there is no room below", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    const height = window.innerHeight;
    Object.assign(window, { innerHeight: 100 });
    handle.open(firstFinding(handle).id);
    expect((cardOf(shadow) as HTMLElement).style.bottom).not.toBe("");
    Object.assign(window, { innerHeight: height });
  });
});

describe("from a findings panel", () => {
  it("selects a finding's text", async () => {
    const { handle } = attach();
    await settled(handle);
    const finding = handle.findings()[0] as Finding;
    handle.reveal(finding.id);
    expect(textarea.selectionStart).toBe(finding.range.start);
    expect(textarea.selectionEnd).toBe(finding.range.end);
    expect(document.activeElement).toBe(textarea);
  });

  it("selects it in a contenteditable element too", async () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    editable.textContent = TEXT;
    document.body.append(editable);
    const { handle } = attach({}, editable);
    await settled(handle);
    const finding = handle.findings()[0] as Finding;
    Element.prototype.scrollIntoView = vi.fn();
    handle.reveal(finding.id);
    expect(document.getSelection()?.toString()).toBe(TEXT.slice(finding.range.start, finding.range.end));
    editable.remove();
  });

  it("ignores a finding", async () => {
    const onFindings = vi.fn();
    const { handle } = attach({ onFindings });
    await settled(handle);
    const finding = handle.findings()[0] as Finding;
    handle.ignore(finding.id);
    expect(handle.findings().map((found) => found.id)).not.toContain(finding.id);
    expect(onFindings.mock.lastCall?.[0]).toEqual(handle.findings());
  });

  it("does nothing for a finding that is gone", async () => {
    const { handle } = attach();
    await settled(handle);
    const count = handle.findings().length;
    handle.reveal("nope");
    handle.ignore("nope");
    expect(handle.findings()).toHaveLength(count);
  });
});

describe("from the keyboard, through the handle", () => {
  it("moves between findings, wrapping around", async () => {
    const { handle, shadow } = attach();
    await settled(handle);
    const sorted = [...handle.findings()].sort((a, b) => a.range.start - b.range.start);
    textarea.focus();
    textarea.setSelectionRange(0, 0);
    handle.move(1);
    expect(shadow.querySelector(".zy-floating")).not.toBeNull();
    textarea.focus();
    textarea.setSelectionRange(TEXT.length, TEXT.length);
    handle.move(1);
    expect(textarea.selectionStart).toBe(sorted[0]?.range.start);
    textarea.focus();
    textarea.setSelectionRange(0, 0);
    handle.move(-1);
    expect(textarea.selectionStart).toBe(sorted.at(-1)?.range.start);
  });

  it("does nothing to move to when nothing is wrong", async () => {
    textarea.value = "Ez hatim.";
    const { handle, shadow } = attach();
    await Promise.resolve();
    handle.move(1);
    expect(shadow.querySelector(".zy-floating")).toBeNull();
  });

  it("applies the first suggestion of the finding at the caret", async () => {
    const [finding] = checker.check(TEXT, { lang: "kmr" }) as [Finding];
    const { handle } = attach({ backend: backendOf({ check: async () => [finding] }) });
    await settled(handle);
    textarea.focus();
    textarea.setSelectionRange(finding.range.start, finding.range.start);
    handle.applyFirst();
    expect(textarea.value).toBe(
      TEXT.slice(0, finding.range.start) + finding.suggestions[0]?.text + TEXT.slice(finding.range.end),
    );
  });

  it("applies nothing away from a finding", async () => {
    textarea.value = "Ez hatim.";
    const { handle } = attach();
    await Promise.resolve();
    handle.applyFirst();
    expect(textarea.value).toBe("Ez hatim.");
  });
});

describe("options", () => {
  it("shows the reason and examples when teaching", async () => {
    const { handle, shadow } = attach({ teaching: true });
    await settled(handle);
    handle.open((handle.findings()[0] as Finding).id);
    expect(shadow.querySelector(".zy-floating")?.textContent).toContain("Why");
  });

  it("marks thick underlines", () => {
    expect(attach({ underline: "thick" }).shadow.querySelector(".zy-thick")).not.toBeNull();
  });

  it("asks for as many words as it was told to", async () => {
    const backend = backendOf();
    attach({ backend, completions: 3 });
    type("ez kit");
    await vi.waitFor(() => expect(backend.complete).toHaveBeenCalledWith("kit", "kmr", 3));
  });

  it("turns typed pairs into Kurmanji letters when asked", () => {
    attach({ typingHelper: true });
    type("de^");
    expect(textarea.value).toBe("dê");
    expect(textarea.selectionStart).toBe(2);
  });

  it("leaves typed pairs alone otherwise", () => {
    attach();
    type("de^");
    expect(textarea.value).toBe("de^");
  });
});

describe("fixing every safe finding", () => {
  it("applies deterministic fixes and leaves the rest", async () => {
    const { handle } = attach();
    await settled(handle);
    const safe = handle.findings().filter((finding) => finding.safeFix);
    expect(safe.length).toBeGreaterThan(0);
    handle.fixSafe();
    expect(textarea.value).toBe("Ez ez hatim.");
  });

  it("skips overlapping fixes", async () => {
    const [finding] = checker.check(TEXT, { lang: "kmr" }) as [Finding];
    const safe = (start: number, end: number, text: string): Finding => ({
      ...finding,
      id: `${start}`,
      safeFix: true,
      range: { start, end },
      suggestions: [{ text }],
    });
    const { handle } = attach({
      backend: backendOf({ check: async () => [safe(0, 5, "A"), safe(3, 8, "B")] }),
    });
    await settled(handle);
    handle.fixSafe();
    expect(textarea.value).toBe("A hatim .");
  });

  it("does nothing when nothing is safe to fix", async () => {
    const [finding] = checker.check(TEXT, { lang: "kmr" }) as [Finding];
    const { handle } = attach({
      backend: backendOf({ check: async () => [{ ...finding, safeFix: false }] }),
    });
    await settled(handle);
    handle.fixSafe();
    expect(textarea.value).toBe(TEXT);
  });

  it("makes one edit of them all, so that one undo takes them all back", async () => {
    const [finding] = checker.check(TEXT, { lang: "kmr" }) as [Finding];
    const safe = (start: number, end: number, text: string): Finding => ({
      ...finding,
      id: `${start}`,
      safeFix: true,
      range: { start, end },
      suggestions: [{ text }],
    });
    const { handle } = attach({
      backend: backendOf({ check: async () => [safe(6, 11, "X"), safe(0, 2, "Y")] }),
    });
    await settled(handle);
    const heard = vi.fn();
    textarea.addEventListener("input", heard);
    handle.fixSafe();
    expect(textarea.value).toBe("Y ez X .");
    expect(heard).toHaveBeenCalledOnce();
  });
});

describe("autocomplete", () => {
  async function typed(shadow: ShadowRoot, text = "ez kit") {
    type(text);
    await vi.waitFor(() => expect(words(shadow).length).toBeGreaterThan(0));
  }

  it("offers words for what is being typed, not the word itself", async () => {
    const { shadow } = attach();
    await typed(shadow);
    expect(words(shadow)).toEqual(["kitêb", "kitêba"]);
  });

  it("keeps focus in the text", async () => {
    const { shadow } = attach();
    await typed(shadow);
    expect(document.activeElement).toBe(textarea);
  });

  it("takes a word with Tab, keeping the rest of the text", async () => {
    const { shadow } = attach();
    await typed(shadow);
    expect(press("Tab").defaultPrevented).toBe(true);
    expect(textarea.value).toBe("ez kitêb");
    expect(textarea.selectionStart).toBe(8);
    expect(words(shadow)).toEqual([]);
  });

  it("does not ask again about the word it just inserted", async () => {
    const backend = backendOf();
    const { shadow } = attach({ backend });
    await typed(shadow);
    press("Tab");
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(backend.complete).toHaveBeenCalledOnce();
  });

  it("lets Enter end the line until a word is chosen", async () => {
    const { shadow } = attach();
    await typed(shadow);
    expect(press("Enter").defaultPrevented).toBe(false);
    expect(words(shadow)).toEqual([]);
    await typed(shadow, "ez kitê");
    press("ArrowDown");
    expect(press("Enter").defaultPrevented).toBe(true);
    expect(textarea.value).toBe("ez kitêb");
  });

  it("moves with the arrow keys, wraps, and announces the word", async () => {
    const { shadow } = attach();
    await typed(shadow);
    const status = () => shadow.querySelector('[role="status"]')?.textContent;
    press("ArrowDown");
    expect(status()).toBe("kitêb");
    press("ArrowDown");
    expect(status()).toBe("kitêba");
    press("ArrowDown");
    expect(status()).toBe("kitêb");
    press("ArrowUp");
    expect(status()).toBe("kitêba");
    press("Tab");
    expect(textarea.value).toBe("ez kitêba");
  });

  it("closes on Escape and when focus leaves", async () => {
    const { shadow } = attach();
    await typed(shadow);
    press("Escape");
    expect(words(shadow)).toEqual([]);
    await typed(shadow, "ez kitê");
    textarea.dispatchEvent(new FocusEvent("blur"));
    expect(words(shadow)).toEqual([]);
  });

  it("leaves other keys to the text", async () => {
    const { shadow } = attach();
    await typed(shadow);
    expect(press("a").defaultPrevented).toBe(false);
    expect(words(shadow).length).toBeGreaterThan(0);
  });

  it("takes a word from a click", async () => {
    const { shadow } = attach();
    await typed(shadow);
    (shadow.querySelector('[role="option"]') as HTMLElement).click();
    expect(textarea.value).toBe("ez kitêb");
  });

  it("waits for two letters, and a caret after a word", async () => {
    const backend = backendOf();
    attach({ backend });
    type("ez k");
    type("ez ");
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(backend.complete).not.toHaveBeenCalled();
  });

  it("can be turned off", async () => {
    const backend = backendOf();
    attach({ backend, autocomplete: false });
    type("ez kit");
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(backend.complete).not.toHaveBeenCalled();
  });

  it("offers nothing when no other word fits", async () => {
    const { shadow } = attach({
      backend: backendOf({ complete: async () => [{ word: "kit", attested: true }] }),
    });
    type("ez kit");
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(words(shadow)).toEqual([]);
  });

  it("drops an answer that has been overtaken by typing", async () => {
    let answer: (found: { word: string; attested: boolean }[]) => void = () => {};
    const { shadow } = attach({
      backend: backendOf({ complete: () => new Promise((resolve) => (answer = resolve)) }),
    });
    type("ez kit");
    await new Promise((resolve) => setTimeout(resolve, 100));
    type("ez ");
    answer([{ word: "kitêb", attested: true }]);
    await Promise.resolve();
    expect(words(shadow)).toEqual([]);
  });

  it("reports a failure", async () => {
    const onError = vi.fn();
    attach({ backend: backendOf({ complete: () => Promise.reject(new Error("no")) }), onError });
    type("ez kit");
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
  });

  it("stays quiet while a word is being composed, then checks", async () => {
    const backend = backendOf();
    const { handle } = attach({ backend });
    await settled(handle);
    const calls = vi.mocked(backend.check).mock.calls.length;
    textarea.dispatchEvent(new CompositionEvent("compositionstart"));
    type("ez kit");
    expect(press("a").defaultPrevented).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(backend.complete).not.toHaveBeenCalled();
    expect(vi.mocked(backend.check).mock.calls.length).toBe(calls);
    textarea.dispatchEvent(new CompositionEvent("compositionend"));
    await vi.waitFor(() => expect(backend.check).toHaveBeenLastCalledWith("ez kit", expect.anything()));
  });
});

describe("styles", () => {
  it("makes a stylesheet work in a shadow root", () => {
    const { shadow, document: outer } = splitStyles(
      ':root{--a:1}:root[data-theme="dark"]{--a:2}:root:not([data-theme="light"]){--a:3}@font-face{font-family:x;src:url(x.woff2)}@property --tw-x{syntax:"*";inherits:false}.a{color:red}',
    );
    expect(shadow).toBe(
      ':host{--a:1}:host([data-theme="dark"]){--a:2}:host(:not([data-theme="light"])){--a:3}.a{color:red}',
    );
    expect(outer).toContain("@font-face");
    expect(outer).toContain("@property --tw-x");
    expect(outer).not.toContain(".a{");
  });

  it("turns rem into pixels, as a page can change what a rem is", () => {
    expect(splitStyles(".a{margin:.25rem 1.5rem}.b{width:2rem}.c-1rem{top:0}").shadow).toBe(
      ".a{margin:4px 24px}.b{width:32px}.c-1rem{top:0}",
    );
  });

  it("handles a stylesheet with nothing to move", () => {
    expect(splitStyles(".a{}")).toEqual({ shadow: ".a{}", document: "" });
  });

  it("adds a style element where constructed sheets do not exist, and removes it", () => {
    const remove = addStyles(document, ".zy-test{}");
    expect(document.head.querySelector("style")?.textContent).toBe(".zy-test{}");
    remove();
    expect(document.head.querySelector("style")).toBeNull();
  });

  it("adds nothing for no styles", () => {
    expect(() => addStyles(document, "")()).not.toThrow();
    expect(document.head.querySelector("style")).toBeNull();
  });

  it("uses a constructed sheet where it can, which a strict page policy allows", () => {
    const replaceSync = vi.fn();
    const original = CSSStyleSheet.prototype.replaceSync;
    CSSStyleSheet.prototype.replaceSync = replaceSync;
    const target = { adoptedStyleSheets: [] as CSSStyleSheet[] } as unknown as Document;
    const remove = addStyles(target, ".a{}");
    expect(replaceSync).toHaveBeenCalledWith(".a{}");
    expect(target.adoptedStyleSheets).toHaveLength(1);
    remove();
    expect(target.adoptedStyleSheets).toHaveLength(0);
    CSSStyleSheet.prototype.replaceSync = original;
  });
});
