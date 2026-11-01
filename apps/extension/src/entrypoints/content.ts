import { attachEditor, type EditorHandle, isCheckable } from "@zimanyar/editor";
import { checkOptionsFrom, parseSettings, type Settings, withWord } from "@zimanyar/settings";
import { browser } from "wxt/browser";
import { backendFor } from "../lib/browser-backend";
import { loadSettings, onSettingsChanged, saveSettings } from "../lib/browser-settings";
import { type PageStatus, toContent } from "../lib/messages";
import overlayCss from "../styles/overlay.css?inline";

declare const __ZIMANYAR_E2E__: boolean;

declare global {
  // eslint-disable-next-line no-var
  var zimanyarStarted: boolean | undefined;
}

export default defineContentScript({
  registration: "runtime",
  matches: ["<all_urls>"],
  async main(context) {
    // Injected once by hand and once by the site's registration, it must still run only once.
    if (globalThis.zimanyarStarted) return;
    globalThis.zimanyarStarted = true;

    let settings: Settings = parseSettings(await loadSettings());
    const editors = new Map<Element, EditorHandle>();
    let last: EditorHandle | null = null;
    const origin = location.origin;
    const backend = backendFor(() => settings, origin);

    const closeAll = () => {
      for (const editor of editors.values()) editor.destroy();
      editors.clear();
      last = null;
    };

    function attach(element: Element): void {
      for (const [other, editor] of editors) {
        if (!other.isConnected) {
          editor.destroy();
          editors.delete(other);
        }
      }
      const existing = editors.get(element);
      if (existing !== undefined) {
        last = existing;
        return;
      }
      const options = checkOptionsFrom(settings);
      const editor = attachEditor(element, {
        backend,
        uiLang: settings.interface.uiLang,
        css: overlayCss,
        // A browser test has to read the overlay. Every other build closes it to the page.
        shadow: __ZIMANYAR_E2E__ ? "open" : "closed",
        theme: settings.interface.theme,
        lang: options.lang,
        strictness: options.strictness,
        disabledRules: options.disabledRules,
        autocomplete: settings.autocomplete.enabled,
        completions: settings.autocomplete.count,
        typingHelper: settings.autocomplete.typingHelper,
        teaching: settings.teaching.mode,
        underline: settings.interface.underline,
        onAddToDictionary: (word) => {
          settings = withWord(settings, word);
          void saveSettings(settings);
        },
        ...(settings.teaching.lessonLinks
          ? {
              onLearn: ({ lang, lessonId, anchor }) =>
                void browser.runtime.sendMessage({ kind: "open-lesson", lesson: { lang, lessonId, anchor } }),
            }
          : {}),
        // The extension was updated or removed under this page, which cannot be recovered from here.
        onError: () => closeAll(),
      });
      if (editor !== null) {
        editors.set(element, editor);
        last = editor;
      }
    }

    const onFocus = (event: Event) => {
      const target = event.composedPath()[0];
      if (target instanceof Element && isCheckable(target)) attach(target);
    };
    document.addEventListener("focusin", onFocus, { capture: true, signal: context.signal });
    const active = document.activeElement;
    if (active !== null && isCheckable(active)) attach(active);

    const stopListening = onSettingsChanged((changed) => {
      settings = changed;
      const focused = document.activeElement;
      closeAll();
      if (focused !== null && isCheckable(focused)) attach(focused);
    });
    context.onInvalidated(() => {
      stopListening();
      closeAll();
    });

    browser.runtime.onMessage.addListener((message: unknown, sender, respond) => {
      if (sender.id !== browser.runtime.id) return false;
      const parsed = toContent.safeParse(message);
      if (!parsed.success) return false;
      const editor = last;
      switch (parsed.data.kind) {
        case "status": {
          const findings = editor?.findings() ?? [];
          const status: PageStatus = {
            count: findings.length,
            lang: findings.find((finding) => finding.lang !== "any")?.lang ?? null,
          };
          respond(status);
          return false;
        }
        case "stop":
          document.removeEventListener("focusin", onFocus, { capture: true });
          closeAll();
          globalThis.zimanyarStarted = false;
          return false;
        case "next-finding":
          editor?.move(1);
          return false;
        case "previous-finding":
          editor?.move(-1);
          return false;
        case "apply-first":
          editor?.applyFirst();
          return false;
      }
    });
  },
});
