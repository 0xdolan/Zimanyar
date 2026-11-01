import { CheckerClient } from "@zimanyar/checker";
import CheckerWorker from "@zimanyar/checker/worker?worker";
import { lessonPath } from "@zimanyar/content/lesson-slugs";
import { CheckerPanel, type CheckMode, type EditorBackend } from "@zimanyar/editor";
import type { UiLang } from "@zimanyar/i18n";
import type { LessonRef, Variety } from "@zimanyar/rules";
import overlayCss from "@zimanyar/ui/styles.css?inline";
import { useCallback, useMemo, useRef } from "react";
import { readShared, writeShared } from "../lib/share";

export interface CheckerAppProps {
  lang: UiLang;
  /** Only the text field, for the landing page. */
  compact?: boolean;
}

const scriptOf = (text: string): Variety => (/\p{Script=Arabic}/u.test(text) ? "ckb" : "kmr");
const BASE = import.meta.env.BASE_URL;

/** One worker and its lexicons for the page. Started on first use, so that a page that never checks pays nothing. */
let shared: { client: CheckerClient; lexicons: Map<Variety, Promise<void>> } | null = null;

function connection() {
  shared ??= { client: new CheckerClient(new CheckerWorker()), lexicons: new Map() };
  return shared;
}

function loadLexicon(lang: Variety): Promise<void> {
  const { client, lexicons } = connection();
  let loading = lexicons.get(lang);
  if (loading === undefined) {
    loading = fetch(`${BASE}lexicons/lexicon-${lang}.bin.gz?v=${import.meta.env.PUBLIC_DATA_VERSION}`)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .then((buffer) =>
        buffer === null ? undefined : client.load(new Uint8Array(buffer)).then(() => undefined),
      );
    lexicons.set(lang, loading);
  }
  return loading;
}

export default function CheckerApp({ lang, compact = false }: CheckerAppProps) {
  const start = useMemo(
    () => (compact || typeof location === "undefined" ? null : readShared(location.hash)),
    [compact],
  );
  const refresh = useRef<() => void>(() => {});

  const backend = useMemo<EditorBackend>(
    () => ({
      // The check does not wait for a lexicon: it answers now and again when the lexicon arrives.
      check: (value, options) => {
        const { client, lexicons } = connection();
        const variety = options.lang === "ckb" || options.lang === "kmr" ? options.lang : scriptOf(value);
        // Only the first time: the check after this one would otherwise ask for another, for ever.
        if (!lexicons.has(variety)) void loadLexicon(variety).then(() => refresh.current());
        return client.check(value, options);
      },
      suggest: (word, language) => connection().client.suggest(word, language),
      complete: (prefix, language, limit) => connection().client.complete(prefix, language, limit),
    }),
    [],
  );

  const onReady = useCallback((again: () => void) => {
    refresh.current = again;
  }, []);

  const onLearn = useCallback(
    (lesson: LessonRef) => {
      const prefix = lang === "en" ? "" : `${lang}/`;
      location.href = `${BASE}${prefix}${lessonPath(lesson.lang as "ckb" | "kmr", lesson.lessonId)}#${lesson.anchor}`;
    },
    [lang],
  );

  const onShare = useCallback(async (text: string, mode: CheckMode) => {
    history.replaceState(null, "", writeShared(text, mode));
    await navigator.clipboard?.writeText(location.href);
  }, []);

  return (
    <CheckerPanel
      backend={backend}
      compact={compact}
      css={overlayCss}
      initialMode={start?.mode ?? "auto"}
      lang={lang}
      onLearn={onLearn}
      onReady={onReady}
      onShare={onShare}
      {...(start !== null ? { initialText: start.text } : {})}
    />
  );
}
