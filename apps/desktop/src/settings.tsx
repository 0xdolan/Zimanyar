import "@zimanyar/app/page.css";
import { applyInterface, SettingsPage } from "@zimanyar/app";
import { createT } from "@zimanyar/i18n";
import type { Settings } from "@zimanyar/settings";
import { Button } from "@zimanyar/ui";
import { createRoot } from "react-dom/client";
import { loadSettings, onSettingsChanged, platformFor } from "./platform";

const mount = createRoot(document.getElementById("root") as HTMLElement);
const draw = (settings: Settings) => {
  applyInterface(settings);
  const t = createT(settings.interface.uiLang);
  mount.render(
    <>
      <nav aria-label={t("nav.main")} className="border-border border-b p-3">
        <Button onClick={() => (location.href = "/")} size="sm" variant="outline">
          {t("nav.check")}
        </Button>
      </nav>
      <SettingsPage platform={platformFor(settings.interface.uiLang)} settings={settings} />
    </>,
  );
};
void loadSettings().then(draw);
onSettingsChanged(draw);
