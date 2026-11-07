import { createT, dirOf, type MessageKey, type UiLang } from "@zimanyar/i18n";
import { CATEGORY_ORDER, type Category, type Finding, renderMessage } from "@zimanyar/rules";
import { BidiText } from "./bidi-text.js";
import { Badge } from "./ui/badge.js";

export interface FindingsPanelProps {
  findings: readonly Finding[];
  lang: UiLang;
  selectedId?: string | null;
  /** What each finding covers, shown so the reader can scan the list. */
  textOf?: (finding: Finding) => string;
  onSelect?: (finding: Finding) => void;
}

function groupByCategory(findings: readonly Finding[]): [Category, Finding[]][] {
  return CATEGORY_ORDER.flatMap((category) => {
    const found = findings.filter((finding) => finding.category === category);
    return found.length > 0 ? [[category, found] as [Category, Finding[]]] : [];
  });
}

/** Every finding in a text, grouped by category, with counts. */
export function FindingsPanel({ findings, lang, selectedId = null, textOf, onSelect }: FindingsPanelProps) {
  const t = createT(lang);
  if (findings.length === 0) {
    return (
      <p className="text-muted-foreground p-4" dir={dirOf(lang)} lang={lang}>
        {t("findings.none")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4" dir={dirOf(lang)} lang={lang}>
      <p aria-live="polite" className="font-semibold">
        {t("findings.count", { count: findings.length })}
      </p>
      {groupByCategory(findings).map(([category, group]) => (
        <section className="flex flex-col gap-2" key={category}>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {t(`category.${category}` as MessageKey)}
            <Badge variant="secondary">{t("findings.count", { count: group.length })}</Badge>
          </h3>
          <ul className="flex list-none flex-col gap-1 p-0">
            {group.map((finding) => (
              <li key={finding.id}>
                <button
                  aria-current={finding.id === selectedId ? "true" : undefined}
                  className="hover:bg-muted aria-[current]:bg-accent aria-[current]:text-accent-foreground w-full rounded-md p-2 text-start"
                  onClick={() => onSelect?.(finding)}
                  type="button"
                >
                  {textOf && (
                    <span className="block font-semibold">
                      <BidiText text={textOf(finding)} />
                    </span>
                  )}
                  <span className="text-sm">
                    <BidiText text={renderMessage(finding.message, lang)} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
