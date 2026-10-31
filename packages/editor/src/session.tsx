import type { UiLang } from "@zimanyar/i18n";
import type { Finding, LessonRef, Strictness, Variety } from "@zimanyar/rules";
import type { AutocompleteItem } from "@zimanyar/ui";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { fieldFor, isCheckable, type Rect, type TextField } from "./field.js";
import { addStyles, OVERLAY_CSS, splitStyles } from "./styles.js";
import { type CompletionView, kindOf, Surface, type Underline } from "./surface.js";
import { shiftFindings, varietyOf, wordBefore } from "./text.js";

/** The checker as the editor sees it: CheckerClient fits, and so does anything else with these. */
export interface EditorBackend {
  check(
    text: string,
    options: {
      lang?: Variety | "auto";
      strictness?: Strictness;
      disabledRules?: readonly string[];
      deferSuggestions: boolean;
    },
  ): Promise<Finding[]>;
  suggest(word: string, lang: Variety): Promise<string[]>;
  complete(prefix: string, lang: Variety, limit: number): Promise<AutocompleteItem[]>;
}

export interface EditorOptions {
  backend: EditorBackend;
  /** The interface language. */
  uiLang: UiLang;
  lang?: Variety | "auto";
  strictness?: Strictness;
  disabledRules?: readonly string[];
  /** The stylesheet of @zimanyar/ui, as text. */
  css?: string;
  theme?: "light" | "dark" | "system";
  autocomplete?: boolean;
  /** Pages cannot reach into a closed shadow root. Only tests have reason to open it. */
  shadow?: ShadowRootMode;
  ipaOf?: (suggestion: string) => string | null;
  onFindings?: (findings: readonly Finding[]) => void;
  onAddToDictionary?: (word: string) => void;
  onLearn?: (lesson: LessonRef) => void;
  onError?: (error: unknown) => void;
}

export interface EditorHandle {
  findings(): readonly Finding[];
  /** Check now, rather than after the pause in typing. */
  refresh(): Promise<void>;
  /** Show a finding's card and move focus to it, for a findings panel beside the text. */
  open(findingId: string): void;
  apply(findingId: string, suggestion: string): void;
  /** Apply every deterministic fix. */
  fixSafe(): void;
  destroy(): void;
}

/** Pauses, in milliseconds. */
const CHECK_PAUSE = 150;
const COMPLETE_PAUSE = 80;
const HOVER_OPEN = 250;
const HOVER_CLOSE = 300;

/** The most a page can use. Each field has its own overlay, and the one with a card goes on top. */
const TOP_LAYER = 2147483647;

const MIN_PREFIX = 2;
const COMPLETIONS = 6;

const contains = (rect: Rect, x: number, y: number): boolean =>
  x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

/** Underlines, the finding card and autocomplete on one text field. Returns null if it may not be checked. */
export function attachEditor(candidate: Element, options: EditorOptions): EditorHandle | null {
  if (!isCheckable(candidate)) return null;
  const element = candidate;
  const document = element.ownerDocument;
  const window = document.defaultView as Window & typeof globalThis;
  const { backend, uiLang, autocomplete = true, shadow = "closed", theme = "system" } = options;

  const host = document.createElement("div");
  host.style.setProperty("all", "initial");
  host.style.setProperty("position", "fixed");
  host.style.setProperty("inset", "0");
  host.style.setProperty("pointer-events", "none");
  if (theme !== "system") host.setAttribute("data-theme", theme);
  const root = host.attachShadow({ mode: shadow });
  const styles = splitStyles(options.css ?? "");
  const removeStyles = [
    addStyles(document, styles.document),
    addStyles(root, `${styles.shadow}\n${OVERLAY_CSS}`),
  ];
  const mount = document.createElement("div");
  mount.setAttribute("lang", uiLang);
  mount.className = "zy-root";
  root.append(mount);
  document.documentElement.append(host);

  // The browser's spellchecker knows no Kurdish: it would underline every word a second time.
  const spellcheck = element.getAttribute("spellcheck");
  element.setAttribute("spellcheck", "false");

  const field: TextField = fieldFor(element, root);
  const surface = createRoot(mount);

  let snapshot = field.text();
  let findings: Finding[] = [];
  let checkId = 0;
  let completeId = 0;
  const ignored = new Set<string>();
  const lookups = new Map<string, readonly string[]>();
  let card: { findingId: string; focus: boolean; byHover: boolean } | null = null;
  let completion: (Omit<CompletionView, "anchor"> & { start: number; end: number }) | null = null;
  let composing = false;
  let replacing = false;
  let frame = 0;
  const timers = { check: 0, complete: 0, open: 0, close: 0 };
  const controller = new AbortController();
  const { signal } = controller;

  const ignoreKey = (finding: Finding): string =>
    `${finding.ruleId}\0${snapshot.slice(finding.range.start, finding.range.end)}`;
  const visible = (): Finding[] => findings.filter((finding) => !ignored.has(ignoreKey(finding)));
  const byId = (id: string): Finding | undefined => findings.find((finding) => finding.id === id);
  const firstRect = (finding: Finding): Rect | null =>
    field.rects(finding.range.start, finding.range.end)[0] ?? null;

  /** A finding's suggestions, with those looked up since its check. */
  const complete = (finding: Finding): Finding => {
    const found = finding.lookup === undefined ? undefined : lookups.get(finding.lookup);
    return found === undefined ? finding : { ...finding, suggestions: found.map((text) => ({ text })) };
  };

  function draw(): void {
    const bounds = element.getBoundingClientRect();
    const box: Rect = {
      left: bounds.left + element.clientLeft,
      top: bounds.top + element.clientTop,
      right: bounds.left + element.clientLeft + element.clientWidth,
      bottom: bounds.top + element.clientTop + element.clientHeight,
    };
    const shown = visible();
    const underlines: Underline[] = shown.flatMap((finding) =>
      field.rects(finding.range.start, finding.range.end).map((rect) => ({
        findingId: finding.id,
        kind: kindOf(finding),
        rect,
      })),
    );
    const open = card === null ? undefined : byId(card.findingId);
    const anchor = open && firstRect(open);
    const end = completion && field.rects(completion.start, completion.end).at(-1);
    host.style.setProperty(
      "z-index",
      String(card !== null || completion !== null ? TOP_LAYER : TOP_LAYER - 1),
    );
    flushSync(() =>
      surface.render(
        <Surface
          box={box}
          card={open && anchor && card ? { finding: complete(open), anchor, focus: card.focus } : null}
          completion={completion && end ? { ...completion, anchor: end } : null}
          count={shown.length}
          direction={getComputedStyle(element).direction === "rtl" ? "rtl" : "ltr"}
          lang={uiLang}
          onApply={(finding, suggestion) => apply(finding.id, suggestion)}
          onBadge={() => {
            const first = shown[0];
            if (first !== undefined) openCard(first.id, true);
          }}
          onCardPointer={(inside) => {
            window.clearTimeout(timers.close);
            if (!inside) closeSoon();
          }}
          onCloseCard={() => closeCard(true)}
          onIgnore={(finding) => {
            ignored.add(ignoreKey(finding));
            closeCard(true);
            publish();
          }}
          onSelectCompletion={acceptCompletion}
          underlines={underlines}
          viewport={{ width: window.innerWidth, height: window.innerHeight }}
          {...(options.ipaOf !== undefined ? { ipaOf: options.ipaOf } : {})}
          {...(options.onLearn !== undefined ? { onLearn: options.onLearn } : {})}
          {...(options.onAddToDictionary !== undefined
            ? {
                onAddToDictionary: (finding: Finding) => {
                  options.onAddToDictionary?.(snapshot.slice(finding.range.start, finding.range.end));
                  ignored.add(ignoreKey(finding));
                  closeCard(true);
                  publish();
                },
              }
            : {})}
        />,
      ),
    );
  }

  function publish(): void {
    options.onFindings?.(visible());
    draw();
  }

  const drawSoon = (): void => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(draw);
  };

  async function runCheck(): Promise<void> {
    window.clearTimeout(timers.check);
    const id = ++checkId;
    const text = snapshot;
    try {
      const found = await backend.check(text, {
        deferSuggestions: true,
        ...(options.lang !== undefined ? { lang: options.lang } : {}),
        ...(options.strictness !== undefined ? { strictness: options.strictness } : {}),
        ...(options.disabledRules !== undefined ? { disabledRules: options.disabledRules } : {}),
      });
      // The text has moved on, so this answer is about something no longer there.
      if (id !== checkId || signal.aborted || text !== snapshot) return;
      findings = found;
      publish();
    } catch (error) {
      if (!signal.aborted) options.onError?.(error);
    }
  }

  function closeCompletion(): void {
    window.clearTimeout(timers.complete);
    completeId++;
    if (completion !== null) {
      completion = null;
      draw();
    }
  }

  function askCompletions(): void {
    window.clearTimeout(timers.complete);
    const id = ++completeId;
    const caret = field.caret();
    const found = caret === null ? null : wordBefore(snapshot, caret);
    if (!autocomplete || caret === null || found === null || found.word.length < MIN_PREFIX) {
      closeCompletion();
      return;
    }
    timers.complete = window.setTimeout(() => {
      backend.complete(found.word, varietyOf(found.word), COMPLETIONS).then(
        (items) => {
          if (id !== completeId || signal.aborted) return;
          const others = items.filter((item) => item.word !== found.word);
          completion =
            others.length === 0 ? null : { items: others, activeIndex: -1, start: found.start, end: caret };
          draw();
        },
        (error: unknown) => {
          if (!signal.aborted) options.onError?.(error);
        },
      );
    }, COMPLETE_PAUSE);
  }

  /** Bring findings up to date with the field after it changed. */
  function sync(): void {
    const next = field.text();
    if (next === snapshot) return;
    findings = shiftFindings(findings, snapshot, next);
    snapshot = next;
    card = null;
    if (composing) {
      draw();
      return;
    }
    window.clearTimeout(timers.check);
    timers.check = window.setTimeout(() => void runCheck(), CHECK_PAUSE);
    if (replacing) completeId++;
    else askCompletions();
    publish();
  }

  function replace(start: number, end: number, text: string): void {
    replacing = true;
    try {
      field.replace(start, end, text);
    } finally {
      replacing = false;
    }
    sync();
  }

  function apply(findingId: string, suggestion: string): void {
    const finding = byId(findingId);
    if (finding === undefined) return;
    closeCard(false);
    replace(finding.range.start, finding.range.end, suggestion);
  }

  function acceptCompletion(item: AutocompleteItem): void {
    if (completion === null) return;
    const { start, end } = completion;
    completion = null;
    replace(start, end, item.word);
    draw();
  }

  function openCard(findingId: string, focus: boolean, byHover = false): void {
    const finding = byId(findingId);
    if (finding === undefined) return;
    window.clearTimeout(timers.close);
    // Passing over another word does not take away a card someone opened on purpose.
    if (byHover && card !== null && !card.byHover) return;
    card = { findingId, focus, byHover };
    const word = finding.lookup;
    if (word !== undefined && !lookups.has(word)) {
      const lang = finding.lang === "any" ? varietyOf(word) : finding.lang;
      backend.suggest(word, lang).then(
        (found) => {
          lookups.set(word, found);
          if (!signal.aborted) draw();
        },
        (error: unknown) => {
          if (!signal.aborted) options.onError?.(error);
        },
      );
    }
    closeCompletion();
    draw();
  }

  function closeCard(returnFocus: boolean): void {
    window.clearTimeout(timers.close);
    if (card === null) return;
    const hadFocus = card.focus;
    card = null;
    draw();
    if (returnFocus && hadFocus) element.focus();
  }

  function closeSoon(): void {
    window.clearTimeout(timers.close);
    if (card?.byHover) timers.close = window.setTimeout(() => closeCard(false), HOVER_CLOSE);
  }

  const findingAt = (x: number, y: number): Finding | undefined =>
    visible().find((finding) =>
      field.rects(finding.range.start, finding.range.end).some((rect) => contains(rect, x, y)),
    );

  function onKeyDown(event: KeyboardEvent): void {
    if (composing) return;
    if (event.altKey && event.key === "Enter") {
      const caret = field.caret() ?? 0;
      const here = visible();
      const finding =
        here.find((found) => caret >= found.range.start && caret <= found.range.end) ??
        here.find((found) => found.range.start > caret) ??
        here[0];
      if (finding !== undefined) {
        event.preventDefault();
        openCard(finding.id, true);
      }
      return;
    }
    if (event.key === "Escape" && card !== null) {
      closeCard(false);
      return;
    }
    if (completion === null) return;
    const { items, activeIndex } = completion;
    const size = items.length;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        completion = {
          ...completion,
          activeIndex:
            event.key === "ArrowDown"
              ? (activeIndex + 1) % size
              : (Math.max(activeIndex, 0) - 1 + size) % size,
        };
        draw();
        break;
      case "Tab":
        event.preventDefault();
        acceptCompletion(items[Math.max(activeIndex, 0)] as AutocompleteItem);
        break;
      case "Enter":
        // Enter ends a line unless the writer has chosen a word.
        if (activeIndex >= 0) {
          event.preventDefault();
          acceptCompletion(items[activeIndex] as AutocompleteItem);
        } else closeCompletion();
        break;
      case "Escape":
        closeCompletion();
        break;
    }
  }

  const listen = { signal };
  element.addEventListener("input", sync, listen);
  element.addEventListener("keydown", onKeyDown as EventListener, listen);
  element.addEventListener("focus", sync, listen);
  element.addEventListener("blur", closeCompletion, listen);
  element.addEventListener("compositionstart", () => (composing = true), listen);
  element.addEventListener(
    "compositionend",
    () => {
      composing = false;
      // The browser's input event may come before this one, so the check it skipped is made here.
      window.clearTimeout(timers.check);
      timers.check = window.setTimeout(() => void runCheck(), CHECK_PAUSE);
      sync();
    },
    listen,
  );
  element.addEventListener(
    "pointermove",
    (event) => {
      const { clientX, clientY } = event as PointerEvent;
      window.clearTimeout(timers.open);
      const finding = findingAt(clientX, clientY);
      if (finding === undefined) closeSoon();
      else {
        window.clearTimeout(timers.close);
        timers.open = window.setTimeout(() => openCard(finding.id, false, true), HOVER_OPEN);
      }
    },
    listen,
  );
  element.addEventListener(
    "pointerleave",
    () => {
      window.clearTimeout(timers.open);
      closeSoon();
    },
    listen,
  );
  element.addEventListener(
    "click",
    (event) => {
      const { clientX, clientY } = event as MouseEvent;
      window.clearTimeout(timers.open);
      const finding = findingAt(clientX, clientY);
      if (finding !== undefined) openCard(finding.id, false);
      else closeCard(false);
    },
    listen,
  );
  // Inside the host means inside the card: the shadow root shows the page no more than that.
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.target !== host && event.target !== element) closeCard(false);
    },
    listen,
  );
  window.addEventListener("scroll", drawSoon, { capture: true, passive: true, signal });
  window.addEventListener("resize", drawSoon, listen);
  const resizing = typeof ResizeObserver === "function" ? new ResizeObserver(drawSoon) : null;
  resizing?.observe(element);
  // A page can change an editable element's text without any input event.
  const mutations = new MutationObserver(sync);
  if (!(element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) {
    mutations.observe(element, { characterData: true, childList: true, subtree: true });
  }

  draw();
  void runCheck();

  return {
    findings: visible,
    refresh: () => {
      const next = field.text();
      if (next !== snapshot) {
        findings = shiftFindings(findings, snapshot, next);
        snapshot = next;
      }
      return runCheck();
    },
    open: (findingId) => openCard(findingId, true),
    apply,
    fixSafe() {
      // From the end, so the earlier offsets stay right.
      const safe = visible()
        .filter((finding) => finding.safeFix && finding.suggestions[0] !== undefined)
        .sort((a, b) => b.range.start - a.range.start);
      let limit = snapshot.length;
      for (const finding of safe) {
        if (finding.range.end > limit) continue;
        limit = finding.range.start;
        replace(finding.range.start, finding.range.end, finding.suggestions[0]?.text as string);
      }
    },
    destroy() {
      controller.abort();
      for (const timer of Object.values(timers)) window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      resizing?.disconnect();
      mutations.disconnect();
      if (spellcheck === null) element.removeAttribute("spellcheck");
      else element.setAttribute("spellcheck", spellcheck);
      surface.unmount();
      field.destroy();
      for (const remove of removeStyles) remove();
      host.remove();
    },
  };
}
