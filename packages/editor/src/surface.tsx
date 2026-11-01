import { createT, formatNumber, type UiLang } from "@zimanyar/i18n";
import type { Finding, LessonRef } from "@zimanyar/rules";
import { type AutocompleteItem, AutocompleteList, FindingCard } from "@zimanyar/ui";
import type { Rect } from "./field.js";

export type UnderlineKind = "error" | "warning" | "hint" | "spelling";

export const kindOf = (finding: Finding): UnderlineKind =>
  finding.category === "spelling" ? "spelling" : finding.severity;

export interface Underline {
  findingId: string;
  kind: UnderlineKind;
  rect: Rect;
}

export interface CompletionView {
  items: readonly AutocompleteItem[];
  /** -1 until the arrow keys are used. */
  activeIndex: number;
  anchor: Rect;
}

interface CardView {
  finding: Finding;
  anchor: Rect;
  /** Opened from the keyboard, so the card takes focus. */
  focus: boolean;
}

export interface SurfaceProps {
  lang: UiLang;
  box: Rect;
  underlines: readonly Underline[];
  count: number;
  /** The space a floating part may use. */
  viewport: { width: number; height: number };
  /** The direction of the text in the field, which floating parts line up with. */
  direction: "ltr" | "rtl";
  card: CardView | null;
  completion: CompletionView | null;
  teaching: boolean;
  ipaOf?: (suggestion: string) => string | null;
  onApply: (finding: Finding, suggestion: string) => void;
  onIgnore: (finding: Finding) => void;
  onAddToDictionary?: (finding: Finding) => void;
  onLearn?: (lesson: LessonRef) => void;
  onCloseCard: () => void;
  onCardPointer: (inside: boolean) => void;
  onSelectCompletion: (item: AutocompleteItem) => void;
  onBadge: () => void;
}

const GAP = 4;
const MARGIN = 8;
const FLOATING_WIDTH = 384;
/** With less room than this below the text, a floating part opens above it. */
const ROOM_BELOW = 240;

/** Lined up with its text from the side the text starts on, on the screen whichever way it has to open. */
function floatingStyle(anchor: Rect, viewport: { width: number; height: number }, direction: "ltr" | "rtl") {
  const furthest = viewport.width - FLOATING_WIDTH - MARGIN;
  const side =
    direction === "rtl"
      ? { right: Math.max(MARGIN, Math.min(viewport.width - anchor.right, furthest)) }
      : { left: Math.max(MARGIN, Math.min(anchor.left, furthest)) };
  return viewport.height - anchor.bottom < ROOM_BELOW
    ? { ...side, bottom: viewport.height - anchor.top + GAP }
    : { ...side, top: anchor.bottom + GAP };
}

/** Everything drawn over a text field. Drawing only: the session owns the state and the keyboard. */
export function Surface({
  lang,
  box,
  underlines,
  count,
  viewport,
  direction,
  card,
  completion,
  teaching,
  ipaOf,
  onApply,
  onIgnore,
  onAddToDictionary,
  onLearn,
  onCloseCard,
  onCardPointer,
  onSelectCompletion,
  onBadge,
}: SurfaceProps) {
  const t = createT(lang);
  const active = completion?.items[completion.activeIndex];
  const countText = count === 0 ? t("findings.none") : t("findings.count", { count });
  return (
    <>
      <div
        className="zy-clip"
        style={{ left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top }}
      >
        {underlines.map(({ findingId, kind, rect }) => (
          <div
            className={`zy-underline zy-${kind}`}
            data-finding={findingId}
            key={`${findingId}:${rect.left}:${rect.top}`}
            style={{
              left: rect.left - box.left,
              top: rect.bottom - box.top - 2,
              width: rect.right - rect.left,
            }}
          />
        ))}
      </div>
      {count > 0 && (
        <button
          aria-label={countText}
          className="zy-badge"
          onClick={onBadge}
          style={{
            // On the side the text ends, where a line is least likely to reach.
            ...(direction === "rtl" ? { left: box.left + GAP } : { right: viewport.width - box.right + GAP }),
            bottom: viewport.height - box.bottom + GAP,
          }}
          type="button"
        >
          {formatNumber(count, lang)}
        </button>
      )}
      {card !== null && (
        <div
          className="zy-floating"
          onPointerEnter={() => onCardPointer(true)}
          onPointerLeave={() => onCardPointer(false)}
          style={floatingStyle(card.anchor, viewport, direction)}
        >
          <FindingCard
            autoFocus={card.focus}
            finding={card.finding}
            key={card.finding.id}
            lang={lang}
            onApply={(suggestion) => onApply(card.finding, suggestion)}
            onClose={onCloseCard}
            onIgnore={() => onIgnore(card.finding)}
            teaching={teaching}
            variant="compact"
            {...(ipaOf !== undefined ? { ipaOf } : {})}
            {...(onAddToDictionary !== undefined
              ? { onAddToDictionary: () => onAddToDictionary(card.finding) }
              : {})}
            {...(onLearn !== undefined ? { onLearn } : {})}
          />
        </div>
      )}
      {completion !== null && (
        <div className="zy-floating" style={floatingStyle(completion.anchor, viewport, direction)}>
          <AutocompleteList
            activeIndex={completion.activeIndex}
            id="zy-words"
            items={completion.items}
            lang={lang}
            onSelect={onSelectCompletion}
          />
        </div>
      )}
      {/* An id cannot point across a shadow root, so the word in focus is announced instead. */}
      <div className="zy-sr" role="status">
        {active?.word ?? countText}
      </div>
    </>
  );
}
