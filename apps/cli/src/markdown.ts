import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { frontmatter } from "micromark-extension-frontmatter";
import { gfm } from "micromark-extension-gfm";

interface Node {
  type: string;
  children?: Node[];
  position?: { start: { offset?: number }; end: { offset?: number } };
}

export const isMarkdown = (path: string): boolean => /\.(md|markdown|mdx)$/i.test(path);

/**
 * The prose of a Markdown document, at the same offsets: everything outside text is blanked with
 * spaces, and line breaks are kept. Code, URLs, HTML and markup are never checked, and a fix made to
 * the prose applies to the document as it is.
 */
export function proseOf(markdown: string): string {
  const tree = fromMarkdown(markdown, {
    extensions: [gfm(), frontmatter(["yaml", "toml"])],
    mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown(["yaml", "toml"])],
  }) as Node;
  const keep: [number, number][] = [];
  const visit = (node: Node): void => {
    if (node.type === "text") {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start !== undefined && end !== undefined) keep.push([start, end]);
      return;
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  // Offsets count UTF-16 units, so the blanking does too, and the length never changes.
  const out: string[] = markdown.split("").map((unit) => (unit === "\n" || unit === "\r" ? unit : " "));
  for (const [start, end] of keep) {
    for (let index = start; index < end; index++) out[index] = markdown[index] as string;
  }
  return out.join("");
}
