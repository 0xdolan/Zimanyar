import { dirOf } from "@zimanyar/i18n";
import type { Settings } from "@zimanyar/settings";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { loadSettings, onSettingsChanged } from "./browser-settings";
import "../styles/page.css";

const FONT_SIZES = { small: "14px", normal: "16px", large: "18px" };

function applyInterface(settings: Settings): void {
  const root = document.documentElement;
  const { uiLang, theme, fontSize } = settings.interface;
  root.lang = uiLang;
  root.dir = dirOf(uiLang);
  root.style.fontSize = FONT_SIZES[fontSize];
  if (theme === "system") delete root.dataset["theme"];
  else root.dataset["theme"] = theme;
}

/** Start an extension page, drawing it again whenever the settings change. */
export async function startPage(render: (settings: Settings) => ReactElement): Promise<void> {
  const mount = createRoot(document.getElementById("root") as HTMLElement);
  const draw = (settings: Settings) => {
    applyInterface(settings);
    mount.render(render(settings));
  };
  draw(await loadSettings());
  onSettingsChanged(draw);
}
