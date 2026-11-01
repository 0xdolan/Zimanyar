import { parseSettings, type Settings } from "@zimanyar/settings";
import { browser } from "wxt/browser";

const KEY = "settings";

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(KEY);
  return parseSettings(stored[KEY]);
}

export const saveSettings = (settings: Settings): Promise<void> =>
  browser.storage.local.set({ [KEY]: settings });

/** Be told of every change, wherever it came from. Returns how to stop. */
export function onSettingsChanged(listener: (settings: Settings) => void): () => void {
  const changed = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    const change = changes[KEY];
    if (area === "local" && change !== undefined) listener(parseSettings(change.newValue));
  };
  browser.storage.onChanged.addListener(changed);
  return () => browser.storage.onChanged.removeListener(changed);
}
