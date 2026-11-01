import { Checker, createHandler } from "@zimanyar/checker";
import { loadLexicon } from "@zimanyar/data";
import { parseSettings } from "@zimanyar/settings";
import { browser } from "wxt/browser";
import { isCheckerRequest, lessonRoute, lexiconsFor, matchPatternOf, toBackground } from "../lib/messages";
import { pronounce, transliterate } from "../lib/writing";

const SCRIPT_ID = "zimanyar-sites";
const CONTENT_SCRIPT = "content-scripts/content.js";

export default defineBackground(() => {
  const checker = new Checker();
  const handle = createHandler(checker, loadLexicon);
  const loaded = new Map<string, Promise<void>>();

  /** Lexicons load when first needed, from the extension's own files. A restarted worker loads them again. */
  function ensureLexicon(lang: string): Promise<void> {
    let loading = loaded.get(lang);
    if (loading === undefined) {
      loading = fetch(browser.runtime.getURL(`/lexicons/lexicon-${lang}.bin.gz` as "/"))
        .then((response) => (response.ok ? response.arrayBuffer() : null))
        .then(async (buffer) => {
          if (buffer !== null) await handle({ type: "load", id: 0, bytes: new Uint8Array(buffer) });
        })
        .catch(() => {});
      loaded.set(lang, loading);
    }
    return loading;
  }

  const openApp = (route: string) =>
    browser.tabs.create({ url: `${browser.runtime.getURL("/app.html")}#${route}` });

  browser.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    // Only this extension's own pages and content scripts. A web page cannot reach here at all.
    if (sender.id !== browser.runtime.id) return false;
    if (isCheckerRequest(message)) {
      void Promise.all(lexiconsFor(message).map(ensureLexicon))
        .then(() => handle(message))
        .then(respond);
      return true;
    }
    const parsed = toBackground.safeParse(message);
    if (parsed.success) {
      const request = parsed.data;
      void openApp(
        request.kind === "open-app"
          ? request.route
          : lessonRoute(request.lesson.lang, request.lesson.lessonId, request.lesson.anchor),
      );
    }
    return false;
  });

  /** Sites run the content script by themselves only once enabled. The list follows the settings. */
  async function syncSites(stored: unknown): Promise<void> {
    const settings = parseSettings(stored);
    const matches = settings.sites.everywhere ? ["<all_urls>"] : settings.sites.enabled.map(matchPatternOf);
    const [existing] = await browser.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
    if (existing !== undefined) await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    if (matches.length === 0) return;
    await browser.scripting
      .registerContentScripts([
        { id: SCRIPT_ID, matches, js: [CONTENT_SCRIPT], runAt: "document_idle", persistAcrossSessions: true },
      ])
      // A site whose permission was withdrawn outside Zimanyar: nothing to run there.
      .catch(() => {});
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes["settings"] !== undefined) void syncSites(changes["settings"].newValue);
  });

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: "check",
      title: "Check selection with Zimanyar",
      contexts: ["selection"],
    });
    browser.contextMenus.create({
      id: "transliterate",
      title: "Transliterate selection",
      contexts: ["selection"],
    });
    browser.contextMenus.create({ id: "ipa", title: "Show IPA", contexts: ["selection"] });
    void browser.storage.local.get("settings").then((stored) => syncSites(stored["settings"]));
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    const text = info.selectionText ?? "";
    if (info.menuItemId === "check") {
      void browser.storage.session.set({ pendingText: text }).then(() => openApp("/check"));
      return;
    }
    if (tab?.id === undefined) return;
    const answer = info.menuItemId === "ipa" ? pronounce(text) : transliterate(text);
    // The click grants this tab for now, through activeTab. The note is plain text in a closed shadow root.
    void browser.scripting
      .executeScript({ target: { tabId: tab.id }, func: showNote, args: [answer] })
      .catch(() => {});
  });

  browser.commands.onCommand.addListener((command, tab) => {
    void (async () => {
      const [active] =
        tab?.id !== undefined ? [tab] : await browser.tabs.query({ active: true, currentWindow: true });
      if (active?.id === undefined) return;
      if (command === "toggle-site") {
        await browser.action.openPopup?.();
        return;
      }
      await browser.tabs.sendMessage(active.id, { kind: command }).catch(() => {});
    })();
  });
});

/** Runs in the page's isolated world, so it may use nothing from outside itself. */
function showNote(text: string): void {
  const host = document.createElement("div");
  host.style.setProperty("all", "initial");
  host.style.setProperty("position", "fixed");
  host.style.setProperty("inset-block-end", "16px");
  host.style.setProperty("inset-inline-end", "16px");
  host.style.setProperty("z-index", "2147483647");
  const root = host.attachShadow({ mode: "closed" });
  const box = document.createElement("div");
  box.setAttribute("role", "status");
  box.dir = "auto";
  box.style.cssText =
    "max-width:24rem;padding:12px 16px;border-radius:8px;background:#1a1d1b;color:#f3f3ef;font:16px/1.6 system-ui,sans-serif;box-shadow:0 4px 16px rgb(0 0 0/.3);cursor:pointer;user-select:text";
  box.textContent = text;
  box.addEventListener("click", () => host.remove());
  root.append(box);
  document.documentElement.append(host);
  setTimeout(() => host.remove(), 15_000);
}
