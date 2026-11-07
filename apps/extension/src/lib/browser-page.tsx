import { applyInterface } from "@zimanyar/app";
import type { Settings } from "@zimanyar/settings";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { loadSettings, onSettingsChanged } from "./browser-settings";
import "@zimanyar/app/page.css";

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
