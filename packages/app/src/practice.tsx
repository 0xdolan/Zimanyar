import type { Course } from "@zimanyar/content";
import { createT, type UiLang } from "@zimanyar/i18n";
import {
  answer,
  type Drill,
  type DrillKind,
  frequentMistakes,
  isRight,
  nextDrill,
  type PracticeState,
  parsePractice,
  progress,
  recommendLessons,
} from "@zimanyar/practice";
import { allRuleMeta, type LessonRef } from "@zimanyar/rules";
import { Button } from "@zimanyar/ui";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { Platform } from "./platform";
import { updatePractice } from "./practice-store";
import { lessonRoute } from "./routes";

type T = ReturnType<typeof createT>;
type Result = "right" | "wrong" | null;

const KINDS: readonly DrillKind[] = ["verb", "noun", "spot"];

function kindLabel(t: T, kind: DrillKind): string {
  if (kind === "verb") return t("practice.kind.verb");
  if (kind === "noun") return t("practice.kind.noun");
  return t("practice.kind.spot");
}

/** The form a drill asks for, in the reader's language. Each key is written out so that checks can find it. */
function cellLabel(t: T, cell: string): string {
  switch (cell) {
    case "present":
      return t("practice.cell.present");
    case "present_neg":
      return t("practice.cell.presentNeg");
    case "past":
      return t("practice.cell.past");
    case "past_neg":
      return t("practice.cell.pastNeg");
    case "subj":
      return t("practice.cell.subj");
    case "imperative":
      return t("practice.cell.imperative");
    case "past_prog":
      return t("practice.cell.pastProg");
    case "perfect":
      return t("practice.cell.perfect");
    case "def.sg":
      return t("practice.cell.defSg");
    case "def.obl.sg":
      return t("practice.cell.obliqueSg");
    case "ind.sg":
    case "ind.dir.sg":
      return t("practice.cell.indSg");
    case "def.pl":
      return t("practice.cell.defPl");
    case "def.obl.pl":
      return t("practice.cell.obliquePl");
    case "ezafe":
    case "def.ez.sg":
      return t("practice.cell.ezafe");
    case "ind.ezafe":
    case "ind.ez.sg":
      return t("practice.cell.indEzafe");
    case "def.ez.pl":
      return t("practice.cell.ezafePl");
    default:
      return t("practice.cell.possessive");
  }
}

const dirOf = (lang: string) => (lang === "ckb" ? "rtl" : "ltr");

/** Drills from the paradigms and the rules, with spaced repetition and the writer's frequent mistakes. */
export function Practice({ lang, practice }: { lang: UiLang; practice: Platform["practice"] }) {
  const t = createT(lang);
  const [state, setState] = useState<PracticeState | null>(null);
  const [course, setCourse] = useState<Course>(lang === "kmr" ? "kmr" : "ckb");
  const [kinds, setKinds] = useState<readonly DrillKind[]>(KINDS);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [given, setGiven] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [counted, setCounted] = useState(false);
  const [done, setDone] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const feedbackId = useId();
  const filter = useMemo(() => ({ lang: course, kinds }), [course, kinds]);

  useEffect(() => {
    void practice.load().then((stored) => setState(parsePractice(stored)));
  }, [practice]);

  const show = (from: PracticeState, skip?: string) => {
    const found = nextDrill(from, filter, Date.now(), new Set(skip === undefined ? [] : [skip]));
    setDrill(found);
    setDone(found === null);
    setGiven("");
    setResult(null);
    setCounted(false);
  };

  // A new drill whenever the choice of drills changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the filter picks a new drill; answers keep it.
  useEffect(() => {
    if (state !== null) show(state);
  }, [state === null, filter]);

  useEffect(() => {
    if (result === "right") next.current?.focus();
    else if (drill?.kind !== "spot") input.current?.focus();
  }, [drill, result]);

  if (state === null) return null;

  const check = async (attempt: string) => {
    if (drill === null || attempt.trim() === "") return;
    const right = isRight(drill, attempt);
    setResult(right ? "right" : "wrong");
    // Only the first try counts for spaced repetition; trying again after the answer is shown is practice.
    if (!counted) {
      setCounted(true);
      setState(await updatePractice(practice, (current) => answer(current, drill.id, right, Date.now())));
    }
  };

  const openLesson = ({ lang: lessonLang, lessonId, anchor }: LessonRef) => {
    location.hash = lessonRoute(lessonLang, lessonId, anchor);
  };
  const toggle = (kind: DrillKind) =>
    setKinds((current) =>
      current.includes(kind)
        ? current.filter((item) => item !== kind)
        : KINDS.filter((item) => item === kind || current.includes(item)),
    );

  const now = Date.now();
  const stats = progress(state, filter, now);
  const recommended = recommendLessons(state.mistakes, now);
  const frequent = frequentMistakes(state.mistakes, now).slice(0, 5);
  const meta = new Map(allRuleMeta().map((rule) => [rule.id, rule]));
  const select = "border-input bg-background min-h-9 rounded-md border px-2";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {t("check.language")}
          <select
            className={select}
            onChange={(event) => setCourse(event.target.value as Course)}
            value={course}
          >
            <option value="ckb">{t("lang.ckb")}</option>
            <option value="kmr">{t("lang.kmr")}</option>
          </select>
        </label>
        <fieldset className="flex flex-wrap gap-3 text-sm">
          <legend className="mb-1">{t("practice.kinds")}</legend>
          {KINDS.map((kind) => (
            <label className="flex min-h-9 items-center gap-2" key={kind}>
              <input
                checked={kinds.includes(kind)}
                className="size-4 accent-current"
                disabled={kinds.length === 1 && kinds.includes(kind)}
                onChange={() => toggle(kind)}
                type="checkbox"
              />
              {kindLabel(t, kind)}
            </label>
          ))}
        </fieldset>
      </div>

      <section aria-labelledby={`${feedbackId}-drill`} className="border-border rounded-lg border p-4">
        <h2 className="sr-only" id={`${feedbackId}-drill`}>
          {t("practice.drill")}
        </h2>
        {done || drill === null ? (
          <p>{t("practice.allDone")}</p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (result === "right") show(state, drill.id);
              else void check(given);
            }}
          >
            <p className="text-muted-foreground text-sm">
              {drill.kind === "spot" ? (
                t("practice.spotPrompt")
              ) : drill.kind === "verb" ? (
                <>
                  <span dir={dirOf(drill.lang)} lang={drill.lang}>
                    {drill.verb}
                  </span>{" "}
                  ({drill.meaning}) · {cellLabel(t, drill.cell)}
                </>
              ) : (
                <>
                  <span dir={dirOf(drill.lang)} lang={drill.lang}>
                    {drill.noun}
                  </span>{" "}
                  ({drill.meaning}
                  {drill.gender === undefined
                    ? ""
                    : `, ${drill.gender === "f" ? t("practice.feminine") : t("practice.masculine")}`}
                  ) · {cellLabel(t, drill.cell)}
                </>
              )}
            </p>

            {drill.kind === "spot" ? (
              <fieldset aria-describedby={feedbackId} className="flex flex-col gap-2">
                <legend className="sr-only">{t("practice.spotPrompt")}</legend>
                {drill.choices.map((choice) => (
                  <Button
                    aria-pressed={given === choice}
                    className="h-auto min-h-11 justify-start text-start text-lg whitespace-normal"
                    dir={dirOf(drill.lang)}
                    disabled={result === "right"}
                    key={choice}
                    lang={drill.lang}
                    onClick={() => {
                      setGiven(choice);
                      void check(choice);
                    }}
                    type="button"
                    variant={result !== null && choice === drill.answer ? "default" : "outline"}
                  >
                    {choice}
                  </Button>
                ))}
              </fieldset>
            ) : (
              <label
                className="flex flex-wrap items-baseline gap-2 text-xl"
                dir={dirOf(drill.lang)}
                lang={drill.lang}
              >
                {drill.kind === "verb" && drill.before !== "" && <span>{drill.before}</span>}
                <input
                  aria-describedby={feedbackId}
                  aria-invalid={result === "wrong" ? true : undefined}
                  aria-label={t("practice.answer")}
                  autoCapitalize="off"
                  autoComplete="off"
                  className="border-input bg-background min-h-11 min-w-40 flex-1 rounded-md border px-3"
                  onChange={(event) => setGiven(event.target.value)}
                  readOnly={result === "right"}
                  ref={input}
                  spellCheck={false}
                  value={given}
                />
                {drill.kind === "verb" && drill.after !== "" && <span>{drill.after}</span>}
              </label>
            )}

            <div aria-live="polite" className="min-h-6" id={feedbackId} role="status">
              {result === "right" && (
                <p className="font-medium text-green-800 dark:text-green-300">✓ {t("practice.right")}</p>
              )}
              {result === "wrong" && (
                <p className="text-red-700 dark:text-red-300">
                  ✗ {t("practice.wrong")}{" "}
                  <bdi className="font-medium" dir={dirOf(drill.lang)} lang={drill.lang}>
                    {drill.answer}
                  </bdi>
                </p>
              )}
              {result !== null && drill.kind === "spot" && drill.gloss !== undefined && (
                <p className="text-muted-foreground text-sm">{drill.gloss}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {drill.kind !== "spot" && result !== "right" && (
                <Button type="submit">
                  {result === "wrong" ? t("practice.tryAgain") : t("practice.check")}
                </Button>
              )}
              <Button
                onClick={() => show(state, drill.id)}
                ref={next}
                type="button"
                variant={result === "right" ? "default" : "outline"}
              >
                {result === null ? t("practice.skip") : t("practice.next")}
              </Button>
              {result !== null && (
                <Button
                  className="text-foreground underline"
                  onClick={() => openLesson(drill.lesson)}
                  type="button"
                  variant="link"
                >
                  {t("practice.lesson")}: {drill.lesson.title}
                </Button>
              )}
            </div>
          </form>
        )}
      </section>

      <section aria-labelledby={`${feedbackId}-progress`}>
        <h2 className="mb-2 text-lg font-semibold" id={`${feedbackId}-progress`}>
          {t("practice.progress")}
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="practice-progress">
          {(
            [
              [t("practice.due"), stats.due],
              [t("practice.seen"), stats.seen],
              [t("practice.mature"), stats.mature],
              [t("practice.today"), `${stats.today.right} / ${stats.today.right + stats.today.wrong}`],
              [t("practice.streak"), stats.streak],
            ] as const
          ).map(([label, value]) => (
            <div className="border-border rounded-md border p-3" key={label}>
              <dt className="text-muted-foreground text-sm">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby={`${feedbackId}-mistakes`}>
        <h2 className="mb-2 text-lg font-semibold" id={`${feedbackId}-mistakes`}>
          {t("practice.frequent")}
        </h2>
        {frequent.length === 0 ? (
          <p className="text-muted-foreground">{t("practice.noMistakes")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <ul className="list-disc ps-6">
              {frequent.map(({ rule, applied, ignored }) => (
                <li key={rule}>
                  {meta.get(rule)?.message[lang] ?? rule}{" "}
                  <span className="text-muted-foreground text-sm">
                    ({t("practice.fixed")} {applied} · {t("practice.dismissed")} {ignored})
                  </span>
                </li>
              ))}
            </ul>
            <h3 className="font-semibold">{t("practice.recommended")}</h3>
            <ul className="flex flex-col gap-1">
              {recommended.map(({ lesson }) => (
                <li key={`${lesson.lang}:${lesson.lessonId}:${lesson.anchor}`}>
                  <Button
                    className="text-foreground h-auto p-0 underline"
                    onClick={() => openLesson(lesson)}
                    variant="link"
                  >
                    {lesson.lang === "ckb" ? t("nav.learnCkb") : t("nav.learnKmr")} {lesson.lessonId}:{" "}
                    {lesson.title}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
