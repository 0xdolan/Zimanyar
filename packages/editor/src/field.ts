/** A box in viewport coordinates. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** What the editor needs from a text field, whichever kind it is. Offsets are UTF-16. */
export interface TextField {
  readonly element: HTMLElement;
  text(): string;
  /** The caret, or null when the field has no caret or a selection. */
  caret(): number | null;
  /** Replace a range as if typed, so undo works and the page hears about it. The caret stays with its text. */
  replace(start: number, end: number, text: string): void;
  /** The boxes a range is drawn in: one per line, and more in mixed-direction text. */
  rects(start: number, end: number): Rect[];
  /** Select a range and scroll it into view. */
  reveal(start: number, end: number): void;
  destroy(): void;
}

const TEXT_INPUTS = new Set(["text", "search"]);
/** Fields whose contents must never be read, whatever their type says. */
const SECRET_AUTOCOMPLETE = /(?:^|\s)(?:cc-|current-password|new-password|one-time-code)/;

/** Whether a field may be checked. Passwords, card numbers and the like never are. */
export function isCheckable(element: Element): element is HTMLElement {
  if (element.getAttribute("autocomplete")?.match(SECRET_AUTOCOMPLETE)) return false;
  if (element instanceof HTMLTextAreaElement) return !element.readOnly && !element.disabled;
  if (element instanceof HTMLInputElement) {
    return TEXT_INPUTS.has(element.type) && !element.readOnly && !element.disabled;
  }
  const editable = element.getAttribute("contenteditable");
  return editable !== null && editable !== "false";
}

function fireInput(element: HTMLElement): void {
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Where a caret belongs after a range was replaced. */
export function caretAfter(caret: number, start: number, end: number, length: number): number {
  if (caret <= start) return caret;
  return caret >= end ? caret + length - (end - start) : start + length;
}

/** The browser's own editing command, which keeps the undo history. False if it did nothing. */
function execute(document: Document, text: string): boolean {
  if (typeof document.execCommand !== "function") return false;
  return text === "" ? document.execCommand("delete") : document.execCommand("insertText", false, text);
}

const present = (rect: DOMRect): boolean => rect.width > 0 && rect.height > 0;

/**
 * A textarea does not tell where its text is drawn, so a hidden copy with the same styles and width
 * is laid out and measured instead.
 */
const COPIED_STYLES = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-stretch",
  "font-variant",
  "font-kerning",
  "font-feature-settings",
  "font-variation-settings",
  "letter-spacing",
  "word-spacing",
  "line-height",
  "text-transform",
  "text-indent",
  "text-align",
  "direction",
  "unicode-bidi",
  "tab-size",
  "white-space",
  "word-break",
  "overflow-wrap",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
];

function controlField(element: HTMLTextAreaElement | HTMLInputElement, container: Node): TextField {
  const document = element.ownerDocument;
  const mirror = document.createElement("div");
  const copy = document.createTextNode("");
  mirror.append(copy);
  mirror.setAttribute("aria-hidden", "true");
  container.appendChild(mirror);

  let measured = "";
  const layOut = (): void => {
    // Styles are read once per text and width: a long text has hundreds of underlines to place.
    const key = `${element.clientWidth}\0${element.clientHeight}\0${element.value}`;
    if (key === measured) return;
    measured = key;
    const style = getComputedStyle(element);
    for (const name of COPIED_STYLES) mirror.style.setProperty(name, style.getPropertyValue(name));
    mirror.style.setProperty("position", "fixed");
    mirror.style.setProperty("left", "0");
    mirror.style.setProperty("top", "0");
    mirror.style.setProperty("visibility", "hidden");
    mirror.style.setProperty("box-sizing", "border-box");
    // clientWidth leaves out the borders and the scrollbar, so lines wrap where the field's do.
    mirror.style.setProperty("width", `${element.clientWidth}px`);
    if (element instanceof HTMLInputElement) {
      // An input centres its one line, and never wraps it.
      const inner =
        element.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom);
      mirror.style.setProperty("white-space", "pre");
      mirror.style.setProperty("line-height", `${inner}px`);
    }
    copy.nodeValue = element.value;
  };

  return {
    element,
    text: () => element.value,
    caret: () =>
      document.activeElement === element && element.selectionStart === element.selectionEnd
        ? element.selectionStart
        : null,
    replace(start, end, text) {
      const caret = element.selectionEnd ?? end;
      const expected = element.value.slice(0, start) + text + element.value.slice(end);
      element.focus();
      element.setSelectionRange(start, end);
      if (!execute(document, text) || element.value !== expected) {
        element.value = expected;
        fireInput(element);
      }
      const next = caretAfter(caret, start, end, text.length);
      element.setSelectionRange(next, next);
    },
    rects(start, end) {
      layOut();
      const range = document.createRange();
      range.setStart(copy, start);
      range.setEnd(copy, end);
      const origin = mirror.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      const x = box.left + element.clientLeft - element.scrollLeft - origin.left;
      const y = box.top + element.clientTop - element.scrollTop - origin.top;
      return [...range.getClientRects()].filter(present).map((rect) => ({
        left: rect.left + x,
        top: rect.top + y,
        right: rect.right + x,
        bottom: rect.bottom + y,
      }));
    },
    reveal(start, end) {
      element.focus();
      element.setSelectionRange(start, end);
      const [first] = this.rects(start, end);
      if (first === undefined) return;
      const box = element.getBoundingClientRect();
      element.scrollTop += first.top - box.top - element.clientHeight / 2;
    },
    destroy: () => mirror.remove(),
  };
}

const BLOCKS = new Set(
  "ADDRESS ARTICLE ASIDE BLOCKQUOTE DD DIV DL DT FIGURE FOOTER H1 H2 H3 H4 H5 H6 HEADER LI MAIN OL P PRE SECTION TABLE TR UL".split(
    " ",
  ),
);
const SKIPPED = new Set(["SCRIPT", "STYLE", "TEMPLATE"]);

interface Segment {
  node: Text;
  start: number;
  end: number;
}

/** The text of an editable element, with a line break for each block, and which node holds what. */
function readEditable(root: HTMLElement): { text: string; segments: Segment[] } {
  let text = "";
  const segments: Segment[] = [];
  const breakLine = (): void => {
    if (text !== "" && !text.endsWith("\n")) text += "\n";
  };
  const visit = (node: Node): void => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        const data = (child as Text).data;
        segments.push({ node: child as Text, start: text.length, end: text.length + data.length });
        text += data;
      } else if (child.nodeType === 1) {
        const element = child as HTMLElement;
        if (element.tagName === "BR") text += "\n";
        // A part of the page set inside the text, such as a mention, is not the writer's text.
        else if (!SKIPPED.has(element.tagName) && element.getAttribute("contenteditable") !== "false") {
          const block = BLOCKS.has(element.tagName);
          if (block) breakLine();
          visit(element);
          if (block) breakLine();
        }
      }
    }
  };
  visit(root);
  return { text, segments };
}

/** The node and offset for a text offset. The end of a range stays in the node before a line break. */
function locate(segments: readonly Segment[], offset: number, isEnd: boolean): [Text, number] | null {
  for (const { node, start, end } of segments) {
    if (isEnd ? offset > start && offset <= end : offset >= start && offset < end) {
      return [node, offset - start];
    }
  }
  // An empty text node or the very end of the text.
  const last = segments.at(-1);
  return last !== undefined && offset === last.end ? [last.node, offset - last.start] : null;
}

function editableField(element: HTMLElement): TextField {
  const document = element.ownerDocument;
  const rangeOf = (start: number, end: number): Range | null => {
    const { segments } = readEditable(element);
    const from = locate(segments, start, false);
    const to = locate(segments, end, true);
    if (from === null || to === null) return null;
    const range = document.createRange();
    range.setStart(...from);
    range.setEnd(...to);
    return range;
  };
  const setCaret = (offset: number): void => {
    const place = locate(readEditable(element).segments, offset, true);
    if (place !== null) document.getSelection()?.collapse(...place);
  };
  const caret = (): number | null => {
    const selection = document.getSelection();
    const node = selection?.focusNode;
    if (!selection?.isCollapsed || !node || !element.contains(node)) return null;
    const { text, segments } = readEditable(element);
    const found = segments.find((segment) => segment.node === node);
    if (found !== undefined) return found.start + selection.focusOffset;
    // The caret sits between elements, such as on an empty line: use the next text after it.
    const child = node.childNodes[selection.focusOffset];
    const next =
      child &&
      segments.find(
        (segment) =>
          segment.node === child ||
          child.contains(segment.node) ||
          child.compareDocumentPosition(segment.node) === Node.DOCUMENT_POSITION_FOLLOWING,
      );
    return next ? next.start : text.length;
  };

  return {
    element,
    text: () => readEditable(element).text,
    caret,
    replace(start, end, text) {
      const before = caret();
      const range = rangeOf(start, end);
      if (range === null) return;
      element.focus();
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      const previous = readEditable(element).text;
      const expected = previous.slice(0, start) + text + previous.slice(end);
      if (!execute(document, text) || readEditable(element).text !== expected) {
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        element.normalize();
        fireInput(element);
      }
      setCaret(caretAfter(before ?? end, start, end, text.length));
    },
    rects(start, end) {
      const range = rangeOf(start, end);
      if (range === null) return [];
      return [...range.getClientRects()].filter(present).map(({ left, top, right, bottom }) => ({
        left,
        top,
        right,
        bottom,
      }));
    },
    reveal(start, end) {
      const range = rangeOf(start, end);
      if (range === null) return;
      element.focus();
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      range.startContainer.parentElement?.scrollIntoView({ block: "nearest" });
    },
    destroy: () => {},
  };
}

/** The field for an element. The copy a textarea is measured with goes in `container`. */
export function fieldFor(element: HTMLElement, container: Node): TextField {
  return element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement
    ? controlField(element, container)
    : editableField(element);
}
