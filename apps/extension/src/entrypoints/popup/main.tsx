import { createT } from "@zimanyar/i18n";
import { isSiteEnabled, type Settings } from "@zimanyar/settings";
import { Button } from "@zimanyar/ui";
import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { QuickCheck } from "../../app/quick-check";
import { startPage } from "../../lib/browser-page";
import { saveSettings } from "../../lib/browser-settings";
import { matchPatternOf, originOf, type PageStatus } from "../../lib/messages";

const CONTENT_SCRIPT = "/content-scripts/content.js";

function Popup({ settings }: { settings: Settings }) {
  const t = createT(settings.interface.uiLang);
  const [tabId, setTabId] = useState<number | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const [status, setStatus] = useState<PageStatus | null>(null);

  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      setTabId(tab?.id ?? null);
      setOrigin(originOf(tab?.url));
      if (tab?.id !== undefined) {
        const answer = await browser.tabs.sendMessage(tab.id, { kind: "status" }).catch(() => null);
        setStatus((answer as PageStatus | null) ?? null);
      }
    });
  }, []);

  const enabled = origin !== null && isSiteEnabled(settings, origin);

  const injectNow = async () => {
    if (tabId !== null) await browser.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT] });
  };

  const toggle = async () => {
    if (origin === null) return;
    const list = settings.sites.enabled;
    if (enabled) {
      await saveSettings({
        ...settings,
        sites: { ...settings.sites, enabled: list.filter((site) => site !== origin) },
      });
      if (tabId !== null) await browser.tabs.sendMessage(tabId, { kind: "stop" }).catch(() => {});
      await browser.permissions.remove({ origins: [matchPatternOf(origin)] }).catch(() => {});
      return;
    }
    // Asked here, as a browser allows the question only right after a click.
    if (!(await browser.permissions.request({ origins: [matchPatternOf(origin)] }))) return;
    await saveSettings({ ...settings, sites: { ...settings.sites, enabled: [...list, origin] } });
    await injectNow();
  };

  return (
    <main className="flex w-[380px] max-w-full flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Zimanyar</h1>
        {status !== null && (
          <span className="text-muted-foreground text-sm">
            {status.count === 0 ? t("findings.none") : t("findings.count", { count: status.count })}
          </span>
        )}
      </header>

      {origin === null ? (
        <p className="text-muted-foreground text-sm">{t("popup.notHere")}</p>
      ) : (
        <section className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <input checked={enabled} className="size-4" onChange={() => void toggle()} type="checkbox" />
            <span>{t("popup.onThisSite")}</span>
          </label>
          <p className="text-muted-foreground text-sm" dir="ltr">
            {origin}
          </p>
          {!enabled && (
            <Button onClick={() => void injectNow()} size="sm" variant="outline">
              {t("popup.justOnce")}
            </Button>
          )}
          {status?.lang && (
            <p className="text-sm">
              {t("popup.language", { language: t(`lang.${status.lang}` as "lang.ckb") })}
            </p>
          )}
        </section>
      )}

      <QuickCheck settings={settings} />

      <footer className="flex flex-wrap gap-2">
        <Button
          onClick={() => void browser.tabs.create({ url: browser.runtime.getURL("/app.html") })}
          size="sm"
        >
          {t("popup.openFull")}
        </Button>
        <Button onClick={() => void browser.runtime.openOptionsPage()} size="sm" variant="outline">
          {t("popup.settings")}
        </Button>
      </footer>
    </main>
  );
}

void startPage((settings) => <Popup settings={settings} />);
