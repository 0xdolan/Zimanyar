import { FullApp } from "../../app/full-app";
import { startPage } from "../../lib/browser-page";

void startPage((settings) => <FullApp settings={settings} />);
