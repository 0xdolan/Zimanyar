import type { EditorHandle } from "../src/index.js";

declare global {
  interface Window {
    /** The demo's editors by field, for browser tests. */
    editors: Record<string, EditorHandle>;
  }
}
