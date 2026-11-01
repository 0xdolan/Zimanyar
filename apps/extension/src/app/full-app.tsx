import { CheckerPanel } from "@zimanyar/editor";
import { createT } from "@zimanyar/i18n";
import type { Settings } from "@zimanyar/settings";
import { withWord } from "@zimanyar/settings";
import { Button } from "@zimanyar/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { backendFor } from "../lib/browser-backend";
import { saveSettings } from "../lib/browser-settings";
import { lessonRoute } from "../lib/messages";
import overlayCss from "../styles/overlay.css?inline";
import { LessonReader } from "./lesson-reader";
import { ParadigmExplorer } from "./paradigm-explorer";
import { Tools } from "./tools";

const routeNow = () => location.hash.replace(/^#/, "") || "/check";

/** The complete app: as a tab, and as Chrome's side panel or Firefox's sidebar. */
export function FullApp({ settings }: { settings: Settings }) {
  const uiLang = settings.interface.uiLang;
  const t = createT(uiLang);
  const [route, setRoute] = useState(routeNow);
  const [pending, setPending] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const current = useRef(settings);
  current.current = settings;
  const backend = useMemo(() => backendFor(() => current.current), []);

  useEffect(() => {
    const changed = () => setRoute(routeNow());
    addEventListener("hashchange", changed);
    return () => removeEventListener("hashchange", changed);
  }, []);

  // Text sent here from the context menu waits once, in session storage.
  useEffect(() => {
    void browser.storage.session.get("pendingText").then(async (stored) => {
      const text = stored["pendingText"];
      if (typeof text === "string") {
        setPending(text);
        await browser.storage.session.remove("pendingText");
      }
      setReady(true);
    });
  }, []);

  const onLearn = useCallback(
    ({ lang, lessonId, anchor }: { lang: string; lessonId: number; anchor: string }) => {
      location.hash = lessonRoute(lang, lessonId, anchor);
    },
    [],
  );
  const onAddToDictionary = useCallback(
    (word: string) => void saveSettings(withWord(current.current, word)),
    [],
  );

  const tabs = [
    ["/check", t("nav.check")],
    ["/learn", t("nav.learn")],
    ["/verbs", t("app.forms")],
    ["/tools", t("app.tools")],
  ] as const;

  return (
    <div className="flex min-h-screen flex-col">
      <nav
        aria-label={t("nav.main")}
        className="border-border flex flex-wrap items-center gap-2 border-b p-3"
      >
        <strong className="me-2">Zimanyar</strong>
        {tabs.map(([path, label]) => (
          <Button
            aria-current={route.startsWith(path) ? "page" : undefined}
            key={path}
            onClick={() => {
              location.hash = path;
            }}
            size="sm"
            variant={route.startsWith(path) ? "default" : "ghost"}
          >
            {label}
          </Button>
        ))}
        <Button
          className="ms-auto"
          onClick={() => void browser.runtime.openOptionsPage()}
          size="sm"
          variant="outline"
        >
          {t("popup.settings")}
        </Button>
      </nav>
      <main className="flex-1 p-4">
        {route.startsWith("/learn") ? (
          <LessonReader lang={uiLang} route={route} />
        ) : route.startsWith("/verbs") ? (
          <ParadigmExplorer lang={uiLang} />
        ) : route.startsWith("/tools") ? (
          <Tools lang={uiLang} />
        ) : (
          ready && (
            <CheckerPanel
              backend={backend}
              css={overlayCss}
              lang={uiLang}
              onAddToDictionary={onAddToDictionary}
              onLearn={onLearn}
              {...(pending !== null ? { initialText: pending } : {})}
            />
          )
        )}
      </main>
    </div>
  );
}
