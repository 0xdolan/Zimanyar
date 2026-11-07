import type { EditorBackend } from "@zimanyar/editor";
import type { Settings } from "@zimanyar/settings";
import type { ReactNode } from "react";

/** What each surface supplies for the app: the extension and the desktop app differ only here. */
export interface Platform {
  /** The checker, with the writer's settings applied to what it finds. */
  backend(settings: () => Settings): EditorBackend;
  /** The stylesheet of the overlay on the text field, as text. */
  overlayCss: string;
  version: string;
  saveSettings(settings: Settings): Promise<void>;
  /** Spaced repetition and the mistake history, stored on this device as JSON. */
  practice: { load(): Promise<unknown>; save(state: unknown): Promise<void> };
  /** Everything stored on this device, gone. */
  clearData(): Promise<void>;
  openSettings(): void;
  openExternal(url: string): void;
  /** Text sent to the checker from elsewhere, once. */
  takePendingText(): Promise<string | null>;
  shortcuts(): Promise<{ description?: string; shortcut?: string }[]>;
  /** Choosing sites to run on, where that means anything. */
  sites?: {
    setEverywhere(on: boolean): Promise<boolean>;
    forget(site: string): Promise<void>;
  };
  /** More buttons for the checker, given a way to read and replace its text. */
  checkerActions?: (text: { get(): string; set(value: string): void }) => ReactNode;
}
