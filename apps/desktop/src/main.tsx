import "@zimanyar/app/page.css";
import { applyInterface, FullApp } from "@zimanyar/app";
import type { Settings } from "@zimanyar/settings";
import { createRoot } from "react-dom/client";
import { loadSettings, onSettingsChanged, platformFor } from "./platform";

const mount = createRoot(document.getElementById("root") as HTMLElement);
const draw = (settings: Settings) => {
  applyInterface(settings);
  mount.render(<FullApp platform={platformFor(settings.interface.uiLang)} settings={settings} />);
};
void loadSettings().then(draw);
onSettingsChanged(draw);
