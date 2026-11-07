import type { Platform } from "@zimanyar/app";
import overlayCss from "@zimanyar/app/overlay.css?inline";
import { browser } from "wxt/browser";
import { backendFor } from "./browser-backend";
import { saveSettings } from "./browser-settings";
import { matchPatternOf } from "./messages";

/** The extension's side of the app. */
export const platform: Platform = {
  backend: (settings) => backendFor(settings),
  overlayCss,
  version: browser.runtime.getManifest().version,
  saveSettings,
  practice: {
    load: async () => (await browser.storage.local.get("practice"))["practice"],
    save: (practice) => browser.storage.local.set({ practice }),
  },
  clearData: () => browser.storage.local.clear(),
  openSettings: () => void browser.runtime.openOptionsPage(),
  openExternal: (url) => void browser.tabs.create({ url }),
  takePendingText: async () => {
    const stored = await browser.storage.session.get("pendingText");
    const text = stored["pendingText"];
    if (typeof text !== "string") return null;
    await browser.storage.session.remove("pendingText");
    return text;
  },
  shortcuts: () => browser.commands.getAll(),
  sites: {
    setEverywhere: async (on) => {
      if (on) return browser.permissions.request({ origins: ["<all_urls>"] });
      await browser.permissions.remove({ origins: ["<all_urls>"] }).catch(() => {});
      return true;
    },
    forget: async (site) => {
      await browser.permissions.remove({ origins: [matchPatternOf(site)] }).catch(() => {});
    },
  },
};
