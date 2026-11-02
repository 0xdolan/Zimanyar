import { invoke } from "@tauri-apps/api/core";

/** Inside the app's window, or in a plain browser, as browser tests run it. */
export const isNative = (): boolean => "__TAURI_INTERNALS__" in window;

const KEY = "zimanyar-settings";

/** Settings as JSON, from $XDG_CONFIG_HOME/zimanyar/settings.json. */
export const readSettings = async (): Promise<unknown> => {
  const stored = isNative() ? await invoke<string | null>("load_settings") : localStorage.getItem(KEY);
  if (stored === null) return {};
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
};

export const writeSettings = async (settings: unknown): Promise<void> => {
  const json = JSON.stringify(settings, null, 1);
  if (isNative()) await invoke("save_settings", { json });
  else localStorage.setItem(KEY, json);
};

export const removeSettings = async (): Promise<void> => {
  if (isNative()) await invoke("clear_settings");
  else localStorage.removeItem(KEY);
};
