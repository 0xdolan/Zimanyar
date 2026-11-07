import { SettingsPage } from "@zimanyar/app";
import { startPage } from "../../lib/browser-page";
import { platform } from "../../lib/browser-platform";

void startPage((settings) => <SettingsPage platform={platform} settings={settings} />);
