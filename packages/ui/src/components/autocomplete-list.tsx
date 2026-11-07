import { createT, dirOf, type UiLang } from "@zimanyar/i18n";
import { BidiText } from "./bidi-text.js";

export interface AutocompleteItem {
  word: string;
  /** False when a form was generated and never seen in the corpus. */
  attested: boolean;
}

export interface AutocompleteListProps {
  id: string;
  items: readonly AutocompleteItem[];
  /** Which item the keyboard is on. The text field keeps focus, and points here. */
  activeIndex: number;
  lang: UiLang;
  onSelect: (item: AutocompleteItem) => void;
}

/** The option's id, for the text field's aria-activedescendant. */
export const optionId = (listId: string, index: number) => `${listId}-option-${index}`;

/** Word suggestions. It only draws: the text field owns the keyboard and the focus. */
export function AutocompleteList({ id, items, activeIndex, lang, onSelect }: AutocompleteListProps) {
  const t = createT(lang);
  return (
    <div
      aria-label={t("autocomplete.label")}
      className="bg-popover text-popover-foreground flex max-h-64 min-w-48 flex-col overflow-auto rounded-lg border border-border p-1 shadow-lg"
      dir={dirOf(lang)}
      id={id}
      role="listbox"
    >
      {items.map((item, index) => (
        // biome-ignore lint/a11y/useKeyWithClickEvents: the text field handles the keyboard
        <div
          aria-selected={index === activeIndex}
          className="hover:bg-muted aria-selected:bg-accent aria-selected:text-accent-foreground flex cursor-default items-center justify-between gap-3 rounded-md px-2 py-1"
          id={optionId(id, index)}
          key={item.word}
          // Pressing the mouse must not take focus from the text being written.
          onClick={() => onSelect(item)}
          onMouseDown={(event) => event.preventDefault()}
          role="option"
          tabIndex={-1}
        >
          <BidiText text={item.word} />
          {!item.attested && (
            <span className="text-muted-foreground text-xs" title={t("autocomplete.neverSeen")}>
              *<span className="sr-only">{t("autocomplete.neverSeen")}</span>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
