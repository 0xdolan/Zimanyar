import { createT, dirOf, formatPercent, type MessageKey, type UiLang } from "@zimanyar/i18n";
import { type Finding, type LessonRef, renderMessage, type Severity } from "@zimanyar/rules";
import { AlertCircle, AlertTriangle, BookOpen, BookPlus, Check, EyeOff, Lightbulb, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils.js";
import { BidiText } from "./bidi-text.js";
import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";
import { Separator } from "./ui/separator.js";

const SEVERITY_ICON: Record<Severity, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  hint: Lightbulb,
};
const SEVERITY_CLASS: Record<Severity, string> = {
  error: "bg-destructive-soft text-destructive",
  warning: "bg-warning-soft text-warning",
  hint: "bg-hint-soft text-hint",
};

/** Who does what in a Kurmanji past tense: the verb agrees with the object, not the doer. */
function ErgativityDiagram({ lang }: { lang: UiLang }) {
  const t = createT(lang);
  const box = "border-border bg-muted rounded-md border px-2 py-1 text-center text-xs";
  return (
    <figure aria-label={t("ergativity.summary")} className="flex flex-col gap-1">
      <div aria-hidden="true" className="grid grid-cols-3 items-center gap-1" dir="ltr">
        <span className={box}>
          min
          <br />
          {t("ergativity.agent")}
        </span>
        <span className={box}>
          tu
          <br />
          {t("ergativity.object")}
        </span>
        <span className={`${box} border-success font-semibold`}>
          dîtî
          <br />
          {t("ergativity.verb")}
        </span>
      </div>
      <figcaption className="text-muted-foreground text-xs">{t("ergativity.summary")}</figcaption>
    </figure>
  );
}

export interface FindingCardProps {
  finding: Finding;
  /** The interface language. */
  lang: UiLang;
  /** compact sits on the page beside the text; expanded sits in the findings panel. */
  variant?: "compact" | "expanded";
  /** Show the examples, reason and lessons even when compact. */
  teaching?: boolean;
  /** Take keyboard focus when shown, as a card opened from the page should. */
  autoFocus?: boolean;
  /** The pronunciation of a suggestion, when teaching mode offers it. */
  ipaOf?: (suggestion: string) => string | null;
  onApply?: (suggestion: string) => void;
  onIgnore?: () => void;
  onAddToDictionary?: () => void;
  onLearn?: (lesson: LessonRef) => void;
  onClose?: () => void;
}

/**
 * One finding: what is wrong, why, how to fix it and where to learn more. Every action is an ordinary
 * button, so Tab moves through the suggestions and Enter applies one. Esc closes the card.
 */
export function FindingCard({
  finding,
  lang,
  variant = "expanded",
  teaching = variant === "expanded",
  autoFocus = false,
  ipaOf,
  onApply,
  onIgnore,
  onAddToDictionary,
  onLearn,
  onClose,
}: FindingCardProps) {
  const t = createT(lang);
  const dir = dirOf(lang);
  const firstAction = useRef<HTMLButtonElement>(null);
  const [showIpa, setShowIpa] = useState(false);
  const Icon = SEVERITY_ICON[finding.severity];

  useEffect(() => {
    if (autoFocus) firstAction.current?.focus();
  }, [autoFocus]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && onClose) {
      event.stopPropagation();
      onClose();
    }
  };
  const ipas = ipaOf
    ? finding.suggestions.flatMap((suggestion) => {
        const ipa = ipaOf(suggestion.text);
        return ipa === null ? [] : [ipa];
      })
    : [];

  return (
    <section
      dir={dir}
      lang={lang}
      onKeyDown={onKeyDown}
      aria-label={renderMessage(finding.message, lang)}
      className={cn(
        "bg-card text-card-foreground flex max-w-md min-w-0 flex-col gap-3 rounded-lg border border-border p-4",
        variant === "compact" && "w-80 max-w-full shadow-lg",
      )}
    >
      <header className="flex items-center gap-2">
        <Badge className={SEVERITY_CLASS[finding.severity]} variant="secondary">
          <Icon aria-hidden="true" data-icon="inline-start" />
          {t(`severity.${finding.severity}` as MessageKey)}
        </Badge>
        <span className="text-muted-foreground text-sm">
          {t(`category.${finding.category}` as MessageKey)}
        </span>
        {onClose && (
          <Button
            aria-label={t("finding.close")}
            className="ms-auto"
            onClick={onClose}
            size="icon-sm"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </header>

      <p className="font-semibold">
        <BidiText text={renderMessage(finding.message, lang)} />
      </p>

      {finding.suggestions.length > 0 ? (
        <ul className="flex list-none flex-wrap gap-2 p-0">
          {finding.suggestions.map((suggestion, index) => (
            <li key={suggestion.text}>
              <Button
                aria-label={t("finding.applyAria", { suggestion: suggestion.text })}
                onClick={() => onApply?.(suggestion.text)}
                ref={index === 0 ? firstAction : undefined}
                size="lg"
              >
                <Check aria-hidden="true" data-icon="inline-start" />
                <BidiText text={suggestion.text} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">{t("finding.noSuggestion")}</p>
      )}

      {ipas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setShowIpa(!showIpa)} size="sm" variant="ghost">
            {showIpa ? t("finding.hideIpa") : t("finding.showIpa")}
          </Button>
          {showIpa && (
            <span className="font-mono text-sm" dir="ltr">
              {t("finding.ipa", { ipa: ipas.join(", ") })}
            </span>
          )}
        </div>
      )}

      {teaching && (
        <>
          <Separator />
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">{t("finding.why")}</h3>
            <p className="max-w-prose text-sm">
              <BidiText text={renderMessage(finding.reason, lang)} />
            </p>
          </div>

          {finding.ruleId.startsWith("kmr.ergative.") && <ErgativityDiagram lang={lang} />}

          {finding.examples.length > 0 && (
            <table className="w-full text-sm">
              <caption className="pb-1 text-start font-semibold">{t("finding.examples")}</caption>
              <thead>
                <tr className="text-muted-foreground text-start">
                  <th className="pe-3 text-start font-normal" scope="col">
                    {t("finding.wrong")}
                  </th>
                  <th className="text-start font-normal" scope="col">
                    {t("finding.right")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {finding.examples.map((example) => (
                  <tr key={example.wrong}>
                    <td className="pe-3 text-destructive">
                      <BidiText text={example.wrong} />
                    </td>
                    <td className="text-success">
                      <BidiText text={example.right} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {finding.lessons.length > 0 && onLearn && (
            <nav aria-label={t("finding.lessons")} className="flex flex-wrap gap-2">
              {finding.lessons.map((lesson) => (
                <Button
                  key={`${lesson.lang}${lesson.lessonId}${lesson.anchor}`}
                  className="h-auto min-h-7 max-w-full text-xs whitespace-normal text-start"
                  onClick={() => onLearn(lesson)}
                  size="sm"
                  variant="outline"
                >
                  <BookOpen aria-hidden="true" data-icon="inline-start" />
                  {/* Lesson titles exist in English only so far, so other interfaces give the number. */}
                  {lang === "en"
                    ? t("finding.lesson", { number: lesson.lessonId, title: lesson.title })
                    : t("finding.lessonNumber", { number: lesson.lessonId })}
                </Button>
              ))}
            </nav>
          )}

          <p className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
            <span>{t("finding.confidence", { percent: formatPercent(finding.confidence, lang) })}</span>
            <span dir="ltr">{t("finding.rule", { id: finding.ruleId })}</span>
          </p>
        </>
      )}

      <footer className="flex flex-wrap gap-2">
        {!teaching && onLearn && finding.lessons[0] && (
          <Button onClick={() => onLearn(finding.lessons[0] as LessonRef)} size="sm" variant="outline">
            <BookOpen aria-hidden="true" data-icon="inline-start" />
            {t("finding.learn")}
          </Button>
        )}
        {onIgnore && (
          <Button onClick={onIgnore} size="sm" variant="ghost">
            <EyeOff aria-hidden="true" data-icon="inline-start" />
            {t("finding.ignore")}
          </Button>
        )}
        {onAddToDictionary && finding.category === "spelling" && (
          <Button onClick={onAddToDictionary} size="sm" variant="ghost">
            <BookPlus aria-hidden="true" data-icon="inline-start" />
            {t("finding.addToDictionary")}
          </Button>
        )}
      </footer>
    </section>
  );
}
