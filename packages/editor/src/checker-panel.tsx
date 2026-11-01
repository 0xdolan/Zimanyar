import { createT, dirOf, type UiLang } from "@zimanyar/i18n";
import type { Finding, LessonRef, Variety } from "@zimanyar/rules";
import { Button, FindingCard, FindingsPanel } from "@zimanyar/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { attachEditor, type EditorBackend, type EditorHandle } from "./session.js";
import { varietyOf } from "./text.js";

export type CheckMode = Variety | "auto";

const SAMPLES: Record<Variety, string> = {
  ckb: "دەرگاەکە کرایەوە. من من نان خواردم. ئەو رۆژە هات.",
  kmr: "Min tu dîtim. Ez dıçım malê. Ez ez nazanim.",
};

export interface CheckerPanelProps {
  lang: UiLang;
  backend: EditorBackend;
  /** The stylesheet of @zimanyar/ui, as text, for the overlay. */
  css: string;
  /** Only the text field, as on a landing page. */
  compact?: boolean;
  initialText?: string;
  initialMode?: CheckMode;
  /** Be told how to check again, for when a lexicon arrives. */
  onReady?: (refresh: () => void) => void;
  /** Offer to share the text. Resolves once the link has been copied. */
  onShare?: (text: string, mode: CheckMode) => Promise<void>;
  onLearn?: (lesson: LessonRef) => void;
  onAddToDictionary?: (word: string) => void;
  /** Called with each change of variety, for a caller that loads data per variety. */
  onModeChange?: (mode: CheckMode) => void;
}

/** A text field with the findings beside it: the checker on the website and in the extension's full view. */
export function CheckerPanel({
  lang,
  backend,
  css,
  compact = false,
  initialText,
  initialMode = "auto",
  onReady,
  onShare,
  onLearn,
  onAddToDictionary,
  onModeChange,
}: CheckerPanelProps) {
  const t = createT(lang);
  const field = useRef<HTMLTextAreaElement>(null);
  const editor = useRef<EditorHandle | null>(null);
  const [mode, setMode] = useState<CheckMode>(initialMode);
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [looked, setLooked] = useState<Record<string, string[]>>({});
  const [start] = useState(initialText ?? SAMPLES[lang === "ckb" ? "ckb" : "kmr"]);

  useEffect(() => {
    if (field.current === null) return;
    const handle = attachEditor(field.current, {
      uiLang: lang,
      lang: mode,
      css,
      theme: document.documentElement.dataset["theme"] === "dark" ? "dark" : "light",
      onFindings: setFindings,
      backend,
      ...(onLearn !== undefined ? { onLearn } : {}),
      ...(onAddToDictionary !== undefined ? { onAddToDictionary } : {}),
    });
    editor.current = handle;
    onReady?.(() => void handle?.refresh());
    return () => {
      handle?.destroy();
      editor.current = null;
    };
  }, [lang, mode, css, backend, onReady, onLearn, onAddToDictionary]);

  const finding = findings.find((found) => found.id === selected) ?? null;
  const looks = finding?.lookup === undefined ? undefined : looked[finding.lookup];
  const shown: Finding | null =
    finding !== null && looks !== undefined
      ? { ...finding, suggestions: looks.map((word) => ({ text: word })) }
      : finding;

  const select = useCallback(
    (chosen: Finding) => {
      setSelected(chosen.id);
      editor.current?.reveal(chosen.id);
      const word = chosen.lookup;
      if (word === undefined) return;
      const variety: Variety = chosen.lang === "any" ? varietyOf(word) : chosen.lang;
      void backend
        .suggest(word, variety)
        .then((words) => setLooked((before) => ({ ...before, [word]: words })));
    },
    [backend],
  );

  const loadSample = (variety: Variety) => {
    if (field.current === null) return;
    field.current.value = SAMPLES[variety];
    void editor.current?.refresh();
  };

  const textarea = (
    <textarea
      aria-label={t("editor.text")}
      className={`border-input bg-background w-full rounded-lg border p-3 text-lg leading-relaxed ${compact ? "min-h-40" : "min-h-72"}`}
      defaultValue={start}
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
            onChange={(event) => {
              const next = event.target.value as CheckMode;
              setMode(next);
              onModeChange?.(next);
            }}
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
        {onShare !== undefined && (
          <Button
            onClick={() => void onShare(field.current?.value ?? "", mode).then(() => setCopied(true))}
            size="sm"
            variant="outline"
          >
            {copied ? t("check.copied") : t("check.share")}
          </Button>
        )}
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
              {...(onLearn !== undefined ? { onLearn } : {})}
            />
          )}
        </div>
      </div>
    </div>
  );
}
