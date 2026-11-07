/**
 * Write what the command line carries: its version and the data's, and every lesson as terminal
 * blocks, with the tables the lesson components compute from the engine. Rendering happens here, once,
 * so the command line needs neither MDX nor React.
 *
 *   tsx --tsconfig ../../packages/content/tsconfig.json scripts/prepare.ts
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate } from "@mdx-js/mdx";
import * as components from "@zimanyar/content/components";
import type { Element, ElementContent, Root, RootContent } from "hast";
import { fromHtml } from "hast-util-from-html";
import { createElement } from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import type { Block } from "../src/blocks.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const OUT = resolve(HERE, "../generated");
const LESSONS = join(ROOT, "packages/content/lessons");

/** The front matter's simple values: JSON where it parses, the plain text otherwise. */
function frontMatter(source: string): Record<string, unknown> {
  const block = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? "";
  return Object.fromEntries(
    block.split("\n").flatMap((line) => {
      const match = /^(\w+):\s*(.*)$/.exec(line);
      if (match === null) return [];
      const [, key, raw] = match as unknown as [string, string, string];
      try {
        return [[key, JSON.parse(raw) as unknown]];
      } catch {
        return [[key, raw]];
      }
    }),
  );
}

const isElement = (node: RootContent | ElementContent): node is Element => node.type === "element";

/** A cell or paragraph as one line: a form's transliteration in brackets, line breaks as spaces. */
function inline(nodes: readonly (RootContent | ElementContent)[]): string {
  let out = "";
  for (const node of nodes) {
    if (node.type === "text") out += node.value;
    else if (isElement(node)) {
      if (node.tagName === "br") out += " ";
      else if (node.tagName === "sub") out += `(${inline(node.children).trim()})`;
      else out += inline(node.children);
    }
  }
  return out.replace(/\s+/g, " ").replace(/ \(/g, " (").trim();
}

const rawText = (node: RootContent | ElementContent): string =>
  node.type === "text" ? node.value : isElement(node) ? node.children.map(rawText).join("") : "";

function rowsOf(table: Element): { header: string[]; rows: string[][] } {
  const rows: Element[] = [];
  const collect = (node: Element) => {
    for (const child of node.children) {
      if (!isElement(child)) continue;
      if (child.tagName === "tr") rows.push(child);
      else collect(child);
    }
  };
  collect(table);
  const cells = (row: Element) =>
    row.children
      .filter(isElement)
      .filter((cell) => cell.tagName === "td" || cell.tagName === "th")
      .map((cell) => inline(cell.children));
  const first = rows[0];
  const hasHeader = first?.children.filter(isElement).every((cell) => cell.tagName === "th") === true;
  return {
    header: hasHeader && first !== undefined ? cells(first) : [],
    rows: (hasHeader ? rows.slice(1) : rows).map(cells),
  };
}

function blocksOf(nodes: readonly (RootContent | ElementContent)[], depth = 0): Block[] {
  const blocks: Block[] = [];
  let loose: (RootContent | ElementContent)[] = [];
  const flush = () => {
    const text = inline(loose);
    if (text !== "") blocks.push({ kind: "p", text });
    loose = [];
  };
  for (const node of nodes) {
    if (!isElement(node)) {
      loose.push(node);
      continue;
    }
    const tag = node.tagName;
    if (/^h[1-6]$/.test(tag)) {
      flush();
      blocks.push({ kind: "h", text: inline(node.children) });
    } else if (tag === "p" || tag === "summary" || tag === "figcaption" || tag === "caption") {
      flush();
      const text = inline(node.children);
      if (text !== "") blocks.push({ kind: "p", text });
    } else if (tag === "ul" || tag === "ol") {
      flush();
      for (const item of node.children.filter(isElement)) {
        const nested = item.children.filter(
          (child) => isElement(child) && (child.tagName === "ul" || child.tagName === "ol"),
        );
        const own = item.children.filter((child) => !nested.includes(child));
        blocks.push({ kind: "li", depth, text: inline(own) });
        blocks.push(...blocksOf(nested, depth + 1));
      }
    } else if (tag === "table") {
      flush();
      blocks.push({ kind: "table", ...rowsOf(node) });
    } else if (tag === "pre") {
      flush();
      blocks.push({ kind: "pre", text: rawText(node).trimEnd() });
    } else if (["div", "section", "details", "figure", "blockquote", "aside", "dl"].includes(tag)) {
      flush();
      blocks.push(...blocksOf(node.children, depth));
    } else {
      loose.push(node);
    }
  }
  flush();
  return blocks;
}

async function render(file: string) {
  const source = readFileSync(file, "utf8");
  const meta = frontMatter(source);
  // The components are passed in, so the lesson's own import of them is not needed.
  const body = source.replace(/^import .*$/gm, "");
  const lesson = await evaluate(body, { ...runtime, remarkPlugins: [remarkFrontmatter, remarkGfm] } as never);
  const html = renderToStaticMarkup(createElement(lesson.default, { components } as never));
  const tree: Root = fromHtml(html, { fragment: true });
  return {
    lang: meta["course"],
    lesson: meta["lesson"],
    title: meta["title"],
    description: meta["description"],
    level: meta["level"],
    rules: meta["rules"] ?? [],
    blocks: blocksOf(tree.children),
  };
}

const version = (JSON.parse(readFileSync(resolve(HERE, "../package.json"), "utf8")) as { version: string })
  .version;
const data = Object.fromEntries(
  readFileSync(join(ROOT, "packages/data/VERSION"), "utf8")
    .split("\n")
    .flatMap((line) => (line.includes("=") ? [line.split("=", 2) as [string, string]] : [])),
);
mkdirSync(OUT, { recursive: true });
writeFileSync(
  join(OUT, "meta.json"),
  `${JSON.stringify({ version, data: data["data"] ?? "", zimankit: data["zimankit"] ?? "" }, null, 2)}\n`,
);
const lessons = [];
for (const course of ["ckb", "kmr"]) {
  for (const name of readdirSync(join(LESSONS, course))
    .filter((file) => file.endsWith(".mdx"))
    .sort()) {
    lessons.push(await render(join(LESSONS, course, name)));
  }
}
writeFileSync(join(OUT, "lessons.json"), JSON.stringify(lessons));
console.log(`prepared ${lessons.length} lessons`);
