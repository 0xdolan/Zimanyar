import { CheckerPanel } from "@zimanyar/editor";
import { createT } from "@zimanyar/i18n";
import { parsePractice, progress, recordMistake } from "@zimanyar/practice";
import type { Settings } from "@zimanyar/settings";
import { withWord } from "@zimanyar/settings";
import { Button } from "@zimanyar/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LessonReader } from "./lesson-reader";
import { ParadigmExplorer } from "./paradigm-explorer";
import type { Platform } from "./platform";
import { Practice } from "./practice";
import { updatePractice } from "./practice-store";
import { lessonRoute } from "./routes";
import { Tools } from "./tools";

const routeNow = () => location.hash.replace(/^#/, "") || "/check";

/** The complete app: as a tab, and as Chrome's side panel or Firefox's sidebar. */
export function FullApp({ settings, platform }: { settings: Settings; platform: Platform }) {
  const uiLang = settings.interface.uiLang;
  const t = createT(uiLang);
  const [route, setRoute] = useState(routeNow);
  const [pending, setPending] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const current = useRef(settings);
  current.current = settings;
  const backend = useMemo(() => platform.backend(() => current.current), [platform]);

  useEffect(() => {
    const changed = () => setRoute(routeNow());
    addEventListener("hashchange", changed);
    return () => removeEventListener("hashchange", changed);
  }, []);

  // Text sent here from elsewhere waits once.
  useEffect(() => {
    void platform.takePendingText().then((text) => {
      setPending(text);
      setReady(true);
    });
  }, [platform]);

  const onLearn = useCallback(
    ({ lang, lessonId, anchor }: { lang: string; lessonId: number; anchor: string }) => {
      location.hash = lessonRoute(lang, lessonId, anchor);
    },
    [],
  );
  const onAct = useCallback(
    (finding: { ruleId: string }, action: "applied" | "ignored") =>
      void updatePractice(platform.practice, (state) =>
        recordMistake(state, finding.ruleId, action, Date.now()),
      ),
    [platform],
  );

  // Drills waiting for review, as a reminder on the tab. Read again on every visit to another tab.
  const [due, setDue] = useState(0);
  const reminders = settings.teaching.practiceReminders;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the route is a reason to count again.
  useEffect(() => {
    if (!reminders) return;
    void platform.practice.load().then((stored) => {
      const state = parsePractice(stored);
      const now = Date.now();
      setDue(
        progress(state, { lang: "ckb", kinds: ["verb", "noun", "spot"] }, now).due +
          progress(state, { lang: "kmr", kinds: ["verb", "noun", "spot"] }, now).due,
      );
    });
  }, [platform, reminders, route]);

  const onAddToDictionary = useCallback(
    (word: string) => void platform.saveSettings(withWord(current.current, word)),
    [platform],
  );

  const tabs = [
    ["/check", t("nav.check")],
    ["/learn", t("nav.learn")],
    ["/verbs", t("app.forms")],
    ["/tools", t("app.tools")],
    ["/practice", t("nav.practice")],
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
            {path === "/practice" && reminders && due > 0 && (
              <span className="bg-primary text-primary-foreground ms-1 rounded-full px-1.5 text-xs tabular-nums">
                <span className="sr-only">{t("practice.dueBadge")} </span>
                {due}
              </span>
            )}
          </Button>
        ))}
        <Button className="ms-auto" onClick={() => platform.openSettings()} size="sm" variant="outline">
          {t("popup.settings")}
        </Button>
      </nav>
      <main className="flex-1 p-4">
        {route.startsWith("/learn") ? (
          <LessonReader lang={uiLang} onExternal={platform.openExternal} route={route} />
        ) : route.startsWith("/verbs") ? (
          <ParadigmExplorer lang={uiLang} />
        ) : route.startsWith("/tools") ? (
          <Tools lang={uiLang} />
        ) : route.startsWith("/practice") ? (
          <Practice lang={uiLang} practice={platform.practice} />
        ) : (
          ready && (
            <CheckerPanel
              backend={backend}
              css={platform.overlayCss}
              lang={uiLang}
              onAddToDictionary={onAddToDictionary}
              onAct={onAct}
              onLearn={onLearn}
              {...(pending !== null ? { initialText: pending } : {})}
              {...(platform.checkerActions !== undefined ? { actions: platform.checkerActions } : {})}
            />
          )
        )}
      </main>
    </div>
  );
}
