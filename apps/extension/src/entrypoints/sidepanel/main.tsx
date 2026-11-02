import { FullApp } from "@zimanyar/app";
import { startPage } from "../../lib/browser-page";
import { platform } from "../../lib/browser-platform";

void startPage((settings) => <FullApp platform={platform} settings={settings} />);
