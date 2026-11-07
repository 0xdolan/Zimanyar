import { dirOf } from "@zimanyar/i18n";
import type { Settings } from "@zimanyar/settings";

const FONT_SIZES = { small: "14px", normal: "16px", large: "18px" };

/** Language, direction, theme and text size, on the page's root. */
export function applyInterface(settings: Settings): void {
  const root = document.documentElement;
  const { uiLang, theme, fontSize } = settings.interface;
  root.lang = uiLang;
  root.dir = dirOf(uiLang);
  root.style.fontSize = FONT_SIZES[fontSize];
  if (theme === "system") delete root.dataset["theme"];
  else root.dataset["theme"] = theme;
}
