import { type Paint, table } from "./terminal.js";

/** A lesson as the terminal shows it. */
export type Block =
  | { kind: "h"; text: string }
  | { kind: "p"; text: string }
  | { kind: "li"; depth: number; text: string }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "pre"; text: string };

export function blockText(block: Block): string {
  switch (block.kind) {
    case "table":
      return [...block.header, ...block.rows.flat()].join(" ");
    default:
      return block.text;
  }
}

export function renderBlocks(blocks: readonly Block[], paint: Paint): string {
  const out: string[] = [];
  blocks.forEach((block, index) => {
    const previous = blocks[index - 1];
    // Items of one list stay together; everything else has a blank line before it.
    if (index > 0 && !(block.kind === "li" && previous?.kind === "li")) out.push("");
    switch (block.kind) {
      case "h":
        out.push(paint.bold(block.text));
        break;
      case "p":
        out.push(block.text);
        break;
      case "li":
        out.push(`${"  ".repeat(block.depth)}* ${block.text}`);
        break;
      case "pre":
        out.push(block.text.replace(/^/gm, "    "));
        break;
      case "table": {
        const width = Math.max(block.header.length, ...block.rows.map((row) => row.length));
        const header = block.header.length > 0 ? block.header : Array.from({ length: width }, () => "");
        out.push(table(header, block.rows, paint));
      }
    }
  });
  return out.join("\n");
}
