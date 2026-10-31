import { CheckerClient } from "@zimanyar/checker";
import CheckerWorker from "@zimanyar/checker/worker?worker";
import { lessonPath } from "@zimanyar/content/lesson-slugs";
import { attachEditor, type EditorHandle } from "@zimanyar/editor";
import { createT, dirOf, type UiLang } from "@zimanyar/i18n";
import type { Finding, Variety } from "@zimanyar/rules";
import { Button, FindingCard, FindingsPanel } from "@zimanyar/ui";
import overlayCss from "@zimanyar/ui/styles.css?inline";
import { useCallback, useEffect, useRef, useState } from "react";
import { readShared, writeShared } from "../lib/share";

export interface CheckerAppProps {
  lang: UiLang;
  /** Only the text field, for the landing page. */
  compact?: boolean;
}

const SAMPLES: Record<Variety, string> = {
  ckb: "دەرگاەکە کرایەوە. من من نان خواردم. ئەو رۆژە هات.",
  kmr: "Min tu dîtim. Ez dıçım malê. Ez ez nazanim.",
};

type Mode = Variety | "auto";

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
  const t = createT(lang);
  const field = useRef<HTMLTextAreaElement>(null);
  const editor = useRef<EditorHandle | null>(null);
  const start = compact ? null : readShared(typeof location === "undefined" ? "" : location.hash);
  const [mode, setMode] = useState<Mode>(start?.mode ?? "auto");
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState(start?.text ?? SAMPLES[lang === "ckb" ? "ckb" : "kmr"]);
  const [copied, setCopied] = useState(false);
  const [looked, setLooked] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (field.current === null) return;
    const handle = attachEditor(field.current, {
      uiLang: lang,
      lang: mode,
      css: overlayCss,
      theme: document.documentElement.dataset["theme"] === "dark" ? "dark" : "light",
      onFindings: setFindings,
      backend: {
        // The check does not wait for a lexicon: it answers now and again when the lexicon arrives.
        check: (value, options) => {
          const { client, lexicons } = connection();
          const variety = mode === "auto" ? scriptOf(value) : mode;
          // Only the first time: the check after this one would otherwise ask for another, for ever.
          if (!lexicons.has(variety)) void loadLexicon(variety).then(() => handle?.refresh());
          return client.check(value, options);
        },
        suggest: (word, language) => connection().client.suggest(word, language),
        complete: (prefix, language, limit) => connection().client.complete(prefix, language, limit),
      },
    });
    editor.current = handle;
    return () => {
      handle?.destroy();
      editor.current = null;
    };
  }, [lang, mode]);

  const finding = findings.find((found) => found.id === selected) ?? null;
  const shown: Finding | null =
    finding?.lookup !== undefined && looked[finding.lookup] !== undefined
      ? { ...finding, suggestions: (looked[finding.lookup] as string[]).map((word) => ({ text: word })) }
      : finding;

  const select = useCallback((chosen: Finding) => {
    setSelected(chosen.id);
    editor.current?.reveal(chosen.id);
    const word = chosen.lookup;
    if (word === undefined) return;
    const variety: Variety = chosen.lang === "any" ? scriptOf(word) : chosen.lang;
    void connection()
      .client.suggest(word, variety)
      .then((words) => setLooked((before) => ({ ...before, [word]: words })));
  }, []);

  const share = () => {
    const value = field.current?.value ?? "";
    history.replaceState(null, "", writeShared(value, mode));
    void navigator.clipboard?.writeText(location.href).then(() => setCopied(true));
  };

  const loadSample = (variety: Variety) => {
    if (field.current === null) return;
    field.current.value = SAMPLES[variety];
    setText(SAMPLES[variety]);
    void editor.current?.refresh();
  };

  const textarea = (
    <textarea
      aria-label={t("editor.text")}
      className={`border-input bg-background w-full rounded-lg border p-3 text-lg leading-relaxed ${compact ? "min-h-40" : "min-h-72"}`}
      defaultValue={text}
      dir="auto"
      onInput={() => setCopied(false)}
      ref={field}
    />
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        {textarea}
        <p className="text-muted-foreground text-sm">{t("check.hint")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" dir={dirOf(lang)}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          {t("check.language")}
          <select
            className="border-input bg-background min-h-9 rounded-md border px-2"
            onChange={(event) => setMode(event.target.value as Mode)}
            value={mode}
          >
            <option value="auto">{t("check.auto")}</option>
            <option value="ckb">{t("lang.ckb")}</option>
            <option value="kmr">{t("lang.kmr")}</option>
          </select>
        </label>
        <Button onClick={() => loadSample("ckb")} size="sm" variant="outline">
          {t("check.sampleCkb")}
        </Button>
        <Button onClick={() => loadSample("kmr")} size="sm" variant="outline">
          {t("check.sampleKmr")}
        </Button>
        <Button
          disabled={!findings.some((found) => found.safeFix)}
          onClick={() => editor.current?.fixSafe()}
          size="sm"
        >
          {t("check.fixAll")}
        </Button>
        <Button onClick={share} size="sm" variant="outline">
          {copied ? t("check.copied") : t("check.share")}
        </Button>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          {textarea}
          <p className="text-muted-foreground text-sm">{t("check.private")}</p>
        </div>
        <div className="flex flex-col gap-4">
          <FindingsPanel
            findings={findings}
            lang={lang}
            onSelect={select}
            selectedId={selected}
            textOf={(found) => (field.current?.value ?? "").slice(found.range.start, found.range.end)}
          />
          {shown !== null && (
            <FindingCard
              finding={shown}
              key={shown.id}
              lang={lang}
              onApply={(suggestion) => {
                editor.current?.apply(shown.id, suggestion);
                setSelected(null);
              }}
              onClose={() => setSelected(null)}
              onIgnore={() => {
                editor.current?.ignore(shown.id);
                setSelected(null);
              }}
              onLearn={(lesson) => {
                const prefix = lang === "en" ? "" : `${lang}/`;
                location.href = `${BASE}${prefix}${lessonPath(lesson.lang, lesson.lessonId)}#${lesson.anchor}`;
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
