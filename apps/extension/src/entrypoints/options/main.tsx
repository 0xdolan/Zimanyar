import { SettingsPage } from "../../app/settings-page";
import { startPage } from "../../lib/browser-page";

void startPage((settings) => <SettingsPage settings={settings} />);
