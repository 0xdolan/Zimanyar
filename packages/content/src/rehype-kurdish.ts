/** The parts of a HAST tree this plugin touches. */
interface Node {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
}

/**
 * A run of Arabic script, with any spaces and punctuation between its words. Digits and Latin letters
 * end a run, so that a run's direction never swallows them.
 */
const RUN =
  /[\p{Script=Arabic}][\p{Script=Arabic}\p{M}‌‍]*(?:[\s،؛؟.,:!?«»()-]+[\p{Script=Arabic}][\p{Script=Arabic}\p{M}‌‍]*)*[؟؛،.!]?/gu;

const SKIPPED = new Set(["code", "pre", "script", "style"]);

/** Split one text node, wrapping each run of Arabic script in its own language and direction. */
export function splitText(text: string): Node[] {
  const out: Node[] = [];
  let last = 0;
  for (const match of text.matchAll(RUN)) {
    if (match.index > last) out.push({ type: "text", value: text.slice(last, match.index) });
    out.push({
      type: "element",
      tagName: "span",
      properties: { lang: "ckb", dir: "rtl" },
      children: [{ type: "text", value: match[0] }],
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

function walk(node: Node): void {
  if (node.children === undefined) return;
  node.children = node.children.flatMap((child) => {
    if (child.type === "text") return splitText(child.value ?? "");
    if (child.type === "element" && SKIPPED.has(child.tagName ?? "")) return [child];
    // A wide table scrolls by itself, so the keyboard has to be able to reach it.
    if (child.tagName === "table") child.properties = { ...child.properties, tabIndex: 0 };
    // Headings keep plain text, as the table of contents and their anchors are read from them.
    if (!/^h[1-6]$/.test(child.tagName ?? "")) walk(child);
    return [child];
  });
}

/** Give Kurdish in Arabic script its language and direction inside English prose. */
export const rehypeKurdish = () => (tree: Node) => walk(tree);
