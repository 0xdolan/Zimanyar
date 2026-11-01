import { CheckerPanel } from "@zimanyar/editor";
import type { Settings } from "@zimanyar/settings";
import { useCallback, useMemo, useRef } from "react";
import { browser } from "wxt/browser";
import { backendFor } from "../lib/browser-backend";
import overlayCss from "../styles/overlay.css?inline";

/** A small text field to try something in, without going to a page. */
export function QuickCheck({ settings }: { settings: Settings }) {
  const current = useRef(settings);
  current.current = settings;
  const backend = useMemo(() => backendFor(() => current.current), []);
  const onLearn = useCallback(
    ({ lang, lessonId, anchor }: { lang: string; lessonId: number; anchor: string }) =>
      void browser.runtime.sendMessage({ kind: "open-lesson", lesson: { lang, lessonId, anchor } }),
    [],
  );
  return (
    <CheckerPanel
      backend={backend}
      compact
      css={overlayCss}
      initialText=""
      lang={settings.interface.uiLang}
      onLearn={onLearn}
    />
  );
}
