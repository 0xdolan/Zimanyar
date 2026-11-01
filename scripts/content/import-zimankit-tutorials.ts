/**
 * Turn zimankit's tutorials into MDX under packages/content/lessons. Each generated block becomes a
 * component that renders from the engine, and the blocks' output goes to packages/content/fixtures, where
 * a test holds the engine to it.
 *
 *   ZIMANKIT_DIR=../ku/zimankit pnpm exec tsx scripts/content/import-zimankit-tutorials.ts
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Course,
  nounsOf,
  referenceVerbs,
  VOCABULARY,
  verbOtherForms,
  verbSections,
  verbSlug,
} from "@zimanyar/content";
import { rulesOfLesson } from "@zimanyar/content/components";
import { COURSE_PATH } from "@zimanyar/content/lesson-slugs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const COMPONENTS = "../../src/components.tsx";

export const LEVELS: Record<string, "beginner" | "intermediate" | "advanced"> = {
  "1-beginner": "beginner",
  "2-intermediate": "intermediate",
  "3-advanced": "advanced",
};

const EM = String.fromCodePoint(0x2014);
const EN = String.fromCodePoint(0x2013);

/** Our writing rules allow neither dash: a comma, "to" or "·" says the same. */
export function withoutDashes(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const inTable = line.trimStart().startsWith("|");
      return line
        .replace(new RegExp(`(\\d)\\s*${EN}\\s*(\\d)`, "g"), "$1 to $2")
        .replace(new RegExp(`\\s+[${EM}${EN}]\\s+`, "g"), inTable ? " · " : ", ")
        .replace(new RegExp(`[${EM}${EN}]`, "g"), "·");
    })
    .join("\n");
}

const TOP = /<!-- nav:top -->.*?<!-- nav:top -->\n*/s;
const BOTTOM = /\n*<!-- nav:bottom -->.*?<!-- nav:bottom -->\n?/s;
const BLOCK = /<!-- gen:(\w+)(.*?)-->(.*?)<!-- \/gen -->/gs;

export interface Block {
  name: string;
  args: Record<string, string>;
  lines: [string, string][];
  /** What zimankit wrote there. */
  output: string;
}

function parseLines(body: string): [string, string][] {
  return body
    .trim()
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const at = line.indexOf("|");
      return at < 0 ? [line.trim(), ""] : [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    });
}

const quoted = (value: string) => JSON.stringify(value);

/** A component for one generated block. */
export function componentFor(block: Block, lang: Course): string {
  const { name, args, lines } = block;
  const attr = (key: string, as = key) =>
    args[key] !== undefined ? ` ${as}=${quoted(args[key] as string)}` : "";
  const items = `items={${JSON.stringify(lines.map(([kurdish, english]) => [kurdish, withoutDashes(english)]))}}`;
  const language = `lang=${quoted(lang)}`;
  switch (name) {
    case "verb":
      return `<VerbTable ${language}${attr("verb")}${attr("cells")}${attr("show")} />`;
    case "noun":
      return `<NounTable ${language}${attr("nouns")}${attr("cells")}${attr("show")} />`;
    case "noun_persons":
      return `<NounPersons ${language}${attr("noun")} />`;
    case "words":
      return `<Words ${language}${attr("words")} />`;
    case "sentences":
      return `<Sentences ${language}${args["ipa"] === "1" ? " ipa" : ""} ${items} />`;
    case "analyze":
      return `<Analyze ${language}${attr("words")} />`;
    case "ergativity":
      return `<Ergativity ${items} />`;
    case "normalize":
      return `<Normalize ${language} ${items} />`;
    case "alphabet":
      return `<Alphabet ${language} />`;
    case "verb_index":
      return `<VerbIndex ${language} />`;
    case "lessons":
      return "";
    default:
      throw new Error(`unknown block ${name}`);
  }
}

export function blocksOf(text: string): Block[] {
  return Array.from(text.matchAll(BLOCK), (match) => {
    const rest = match[2] as string;
    const newline = rest.indexOf("\n");
    const first = newline < 0 ? rest : rest.slice(0, newline);
    return {
      name: match[1] as string,
      args: Object.fromEntries(Array.from(first.matchAll(/(\w+)=(\S+)/g), (arg) => [arg[1], arg[2]])),
      lines: newline < 0 ? [] : parseLines(rest.slice(newline + 1)),
      output: (match[3] as string).trim(),
    };
  });
}

/** Keep MDX from reading prose as code: only code spans and fences may hold braces and angle brackets as they are. */
export function escapeForMdx(text: string): string {
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part
            .replace(/\{/g, "&#123;")
            .replace(/\}/g, "&#125;")
            .replace(/<(?![a-zA-Z/])/g, "&lt;")
            .replace(/<br>/g, "<br />")
            // MDX reads markdown inside a tag only with blank lines around it.
            .replace(/<details>\s*<summary>(.*?)<\/summary>\s*/g, "<details>\n<summary>$1</summary>\n\n")
            .replace(/\s*<\/details>/g, "\n\n</details>"),
    )
    .join("");
}

/** Where a tutorial file ends up on the site, relative to the course. */
export function targetOf(file: string): string {
  const name = basename(file, ".md");
  const folder = dirname(file);
  if (name === "README") return folder.endsWith("verbs") ? "verbs/" : "";
  return folder.endsWith("verbs") ? `verbs/${name}/` : `${name}/`;
}

/** Rewrite a link between tutorials for the site's layout, leaving other links alone. */
export function rewriteLinks(text: string, file: string, lang: Course): string {
  return text.replace(/\]\(([^)\s]+?\.md)(#[^)\s]*)?\)/g, (_all, href: string, hash = "") => {
    const resolved = posix.normalize(posix.join(lang, posix.dirname(file), href));
    const [course, ...rest] = resolved.split("/");
    if (course !== "ckb" && course !== "kmr") {
      // Outside the courses: the rest of zimankit's documentation lives with zimankit.
      const docs = posix.normalize(posix.join("docs/tutorials", resolved));
      return `](https://github.com/0xdolan/zimankit/blob/main/${docs}${hash})`;
    }
    const here = posix.join(COURSE_PATH[lang], targetOf(file));
    // Links between the two courses go by address, which is not the folder's name.
    const there = posix.join(COURSE_PATH[course], targetOf(rest.join("/")));
    const path = posix.relative(here, there);
    return `](${path === "" ? "./" : `${path}/`}${hash})`;
  });
}

const yamlString = (value: string) => JSON.stringify(value);

const COURSE_NAME: Record<Course, string> = { ckb: "Sorani", kmr: "Kurmanji" };

export interface Page {
  file: string;
  frontmatter: string[];
  imports: string[];
  body: string;
}

const COMPONENT_NAME = /<([A-Z][A-Za-z]+)/g;

export function renderPage({ frontmatter, body }: Omit<Page, "file" | "imports">, depth = 0): string {
  const names = [...new Set(Array.from(body.matchAll(COMPONENT_NAME), (match) => match[1] as string))].sort();
  const from = "../".repeat(depth) + COMPONENTS;
  return [
    "---",
    ...frontmatter,
    "---",
    "",
    ...(names.length > 0 ? [`import { ${names.join(", ")} } from ${quoted(from)};`, ""] : []),
    body.trim(),
    "",
  ].join("\n");
}

/** One tutorial as a page body: navigation out, blocks to components, links and writing to our rules. */
export function convertBody(text: string, file: string, lang: Course): string {
  const placeholders: string[] = [];
  const withoutNav = text
    .replace(TOP, "")
    .replace(BOTTOM, "\n")
    .replace(/^\*\*(?:On this page|Level):\*\*[^\n]*\n/gm, "")
    .replace(/^\[[^\n]*(?:course|Course)\]\([^\n]*\n/m, "");
  const swapped = withoutNav.replace(BLOCK, (whole) => {
    const [block] = blocksOf(whole);
    placeholders.push(componentFor(block as Block, lang));
    return `ZYBLOCK${placeholders.length - 1}ZYEND`;
  });
  const body = rewriteLinks(escapeForMdx(withoutDashes(swapped)), file, lang).replace(/^# .*\n/m, "");
  return body.replace(/ZYBLOCK(\d+)ZYEND/g, (_all, index: string) => placeholders[Number(index)] as string);
}

const titleOf = (text: string): string => withoutDashes(/^# (.+)$/m.exec(text)?.[1] ?? "");

/* v8 ignore start: needs a zimankit checkout */
function main(): void {
  const zimankit = resolve(ROOT, process.env["ZIMANKIT_DIR"] ?? "../ku/zimankit");
  const tutorials = join(zimankit, "docs/tutorials");
  const out = join(ROOT, "packages/content/lessons");
  writeVocabulary(tutorials);
  rmSync(out, { recursive: true, force: true });
  const write = (file: string, content: string) => {
    mkdirSync(dirname(join(out, file)), { recursive: true });
    writeFileSync(join(out, file), content);
  };
  const fixtures: Record<Course, Block[]> = { ckb: [], kmr: [] };
  const slugs: Record<Course, Record<string, string>> = { ckb: {}, kmr: {} };

  for (const lang of ["ckb", "kmr"] as const) {
    const course = join(tutorials, lang);
    const collect = (file: string, text: string) => {
      fixtures[lang].push(
        ...blocksOf(text)
          .filter((block) => block.name !== "lessons" && block.name !== "verb_index")
          .map((block) => ({ ...block, output: withoutDashes(block.output) })),
      );
      return convertBody(text, file, lang);
    };

    for (const [folder, level] of Object.entries(LEVELS)) {
      for (const name of readdirSync(join(course, folder)).sort()) {
        const file = `${folder}/${name}`;
        const text = readFileSync(join(course, file), "utf8");
        const lesson = Number(name.slice(0, 2));
        slugs[lang][String(lesson)] = basename(name, ".md");
        const rules = rulesOfLesson(lang, lesson);
        const checks =
          rules.length > 0
            ? `\n\n## Zimanyar checks this\n\n<LessonRules lang="${lang}" lesson={${lesson}} />`
            : "";
        write(
          `${lang}/${basename(name, ".md")}.mdx`,
          renderPage({
            frontmatter: [
              `title: ${yamlString(titleOf(text))}`,
              `description: ${yamlString(`${COURSE_NAME[lang]} lesson ${lesson}: ${titleOf(text).replace(/^\d+\.\s*/, "")}`)}`,
              `course: ${lang}`,
              `lesson: ${lesson}`,
              `level: ${level}`,
              `rules: ${JSON.stringify(rules)}`,
            ],
            body: collect(file, text) + checks,
          }),
        );
      }
    }

    const readme = readFileSync(join(course, "README.md"), "utf8");
    write(
      `${lang}/index.mdx`,
      renderPage({
        frontmatter: [
          `title: ${yamlString(titleOf(readme))}`,
          `description: "A course of 23 lessons in ${COURSE_NAME[lang]}, from the alphabet to the written standard."`,
          `course: ${lang}`,
        ],
        body: collect("README.md", readme),
      }),
    );

    const cheat = readFileSync(join(course, "reference/cheat-sheet.md"), "utf8");
    write(
      `${lang}/cheat-sheet.mdx`,
      renderPage({
        frontmatter: [
          `title: ${yamlString(titleOf(cheat))}`,
          `description: "${COURSE_NAME[lang]} grammar on one page."`,
          `course: ${lang}`,
        ],
        body: collect("reference/cheat-sheet.md", cheat),
      }),
    );

    write(
      `${lang}/vocabulary.mdx`,
      renderPage({
        frontmatter: [
          'title: "Vocabulary"',
          `description: "Every word in the ${COURSE_NAME[lang]} lessons."`,
          `course: ${lang}`,
        ],
        body: `<Vocabulary lang="${lang}" />`,
      }),
    );

    const sections = nounsOf(lang).map((noun) => {
      const [meaning, note] = VOCABULARY[lang][noun] as [string, string];
      const heading = `## ${noun}: ${withoutDashes(meaning)}${lang === "kmr" ? ` (${note})` : ""}`;
      return `${heading}\n\n<NounForms lang="${lang}" noun=${quoted(noun)} />`;
    });
    write(
      `${lang}/nouns.mdx`,
      renderPage({
        frontmatter: [
          'title: "Noun declension tables"',
          `description: "Every form of the nouns in the ${COURSE_NAME[lang]} lessons."`,
          `course: ${lang}`,
        ],
        body: `Generated by the engine, with the same suffix rules the analyzer uses.\n\n${sections.join("\n\n")}`,
      }),
    );

    const index = readFileSync(join(course, "reference/verbs/README.md"), "utf8");
    write(
      `${lang}/verbs/index.mdx`,
      renderPage(
        {
          frontmatter: [
            `title: ${yamlString(titleOf(index))}`,
            `description: "Every ${COURSE_NAME[lang]} verb with its own page."`,
            `course: ${lang}`,
          ],
          body: collect("reference/verbs/README.md", index),
        },
        1,
      ),
    );

    for (const infinitive of referenceVerbs(lang)) {
      const parts = verbSections(lang, infinitive).map(
        ({ title, cells }) =>
          `## ${title}\n\n<VerbTable lang="${lang}" verb=${quoted(infinitive)} cells="${cells.join(",")}" show="translit,ipa" noCaption />`,
      );
      const others =
        verbOtherForms(lang, infinitive).length > 0
          ? [`## Other forms\n\n<VerbOtherForms lang="${lang}" verb=${quoted(infinitive)} />`]
          : [];
      const meaning = VOCABULARY[lang][infinitive]?.[0] ?? "";
      write(
        `${lang}/verbs/${verbSlug(lang, infinitive)}.mdx`,
        renderPage(
          {
            frontmatter: [
              `title: ${yamlString(`${infinitive}: ${withoutDashes(meaning)}`)}`,
              `description: ${yamlString(`The ${COURSE_NAME[lang]} verb ${infinitive}, "${withoutDashes(meaning)}", in every tense.`)}`,
              `course: ${lang}`,
              "prev: false",
              "next: false",
            ],
            body: [`<VerbInfo lang="${lang}" verb=${quoted(infinitive)} />`, ...parts, ...others].join(
              "\n\n",
            ),
          },
          1,
        ),
      );
    }
  }

  writeFileSync(join(ROOT, "packages/content/src/lesson-slugs.json"), `${JSON.stringify(slugs, null, 1)}\n`);
  writeFileSync(
    join(ROOT, "packages/content/fixtures/blocks.json"),
    `${JSON.stringify(fixtures, null, 1)}\n`,
  );
  console.log(`wrote ${relative(ROOT, out)}: ${fixtures.ckb.length + fixtures.kmr.length} generated blocks`);
}

/** The vocabulary first, as the tables above read it. */
export function writeVocabulary(tutorials: string): void {
  const out: Record<string, Record<string, [string, string]>> = {};
  for (const lang of ["ckb", "kmr"]) {
    const entries: Record<string, [string, string]> = {};
    for (const line of readFileSync(join(tutorials, "_data", `${lang}_vocab.tsv`), "utf8").split("\n")) {
      if (line.trim() === "" || line.startsWith("#")) continue;
      const [word = "", meaning = "", note = ""] = line.split("\t");
      entries[word.trim()] = [withoutDashes(meaning.trim()), note.trim()];
    }
    out[lang] = entries;
  }
  writeFileSync(join(ROOT, "packages/content/src/vocabulary.json"), `${JSON.stringify(out, null, 1)}\n`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
