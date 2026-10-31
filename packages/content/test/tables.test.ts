import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  analyzeRows,
  type Course,
  ckbAlphabet,
  ergativityRows,
  type FormCell,
  kmrAlphabet,
  normalizeRows,
  nounPersons,
  nounReference,
  nounsOf,
  nounTable,
  OTHER_SCRIPT,
  referenceVerbs,
  textIpa,
  textOther,
  verbIndexRows,
  verbOf,
  verbOtherForms,
  verbSections,
  verbSlug,
  verbTable,
  vocabularyRows,
  wordRows,
} from "../src/tables.js";

interface Block {
  name: string;
  args: Record<string, string>;
  lines: [string, string][];
  output: string;
}

const fixtures = JSON.parse(
  readFileSync(new URL("../fixtures/blocks.json", import.meta.url), "utf8"),
) as Record<Course, Block[]>;

const EMPTY = "·";

function cellText(cell: FormCell): string {
  if (cell === null) return EMPTY;
  return [
    `**${cell.form}**`,
    ...(cell.other !== undefined ? [`<sub>${cell.other}</sub>`] : []),
    ...(cell.ipa !== undefined ? [`<sub>/${cell.ipa}/</sub>`] : []),
  ].join("<br>");
}

const table = (head: readonly string[], rows: readonly (readonly string[])[]) =>
  [
    `| ${head.join(" | ")} |`,
    `|${"---|".repeat(head.length)}`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");

/** The data as zimankit's markdown, with its dashes replaced as the importer replaces them. */
function asMarkdown(lang: Course, { name, args, lines }: Block): string {
  const other = OTHER_SCRIPT[lang];
  switch (name) {
    case "verb": {
      const data = verbTable(
        lang,
        args["verb"] as string,
        (args["cells"] ?? "present").split(","),
        args["show"],
      );
      const ergativeColumns = lang === "kmr" && data.ergative;
      const head = [
        "person",
        ...(ergativeColumns ? ["agent (oblique)", "object (direct)"] : ["pronoun"]),
        ...data.columns,
      ];
      const rows = data.rows.map((row) => [
        row.person,
        ...(row.oblique !== undefined ? [row.oblique] : []),
        row.pronoun,
        ...row.cells.map(cellText),
      ]);
      const preverb = data.preverb ? `, preverb **${data.preverb}**` : "";
      const caption = `*${data.infinitive}* (${data.other}) “${data.meaning}”, present stem **${data.present}**, past stem **${data.past}**, ${data.transitive ? "transitive" : "intransitive"}${preverb}`;
      const note = !data.ergative
        ? ""
        : lang === "kmr"
          ? "\n\n> Past tenses of a transitive verb are **ergative**: the agent is oblique and the verb agrees with the **object** (the *object* column), e.g. *min tu dîtî* “I saw you”."
          : "\n\n> Past tenses of a transitive verb are **ergative**: the person marker is the set-2 clitic (م ت ی مان تان یان) of the **agent**, not a verb ending.";
      return `${caption}\n\n${table(head, rows)}${note}`;
    }
    case "noun": {
      const data = nounTable(
        lang,
        (args["nouns"] as string).split(","),
        args["cells"]?.split(","),
        args["show"],
      );
      return table(
        ["noun", "meaning", ...(data.gender ? ["gender"] : []), ...data.columns],
        data.rows.map((row) => [
          `**${row.noun}**`,
          row.meaning,
          ...(row.gender !== undefined ? [row.gender] : []),
          ...row.cells.map(cellText),
        ]),
      );
    }
    case "noun_persons": {
      const data = nounPersons(lang, args["noun"] as string);
      return `*${data.noun}* “${data.meaning}”\n\n${table(
        ["person", "pronoun", "my/your… + noun", "the noun + clitic"],
        data.rows.map((row) => [row.person, row.pronoun, cellText(row.bare), cellText(row.definite)]),
      )}`;
    }
    case "words":
      return table(
        ["Kurdish", other, "IPA", "syllables", "meaning"],
        wordRows(lang, (args["words"] as string).split(",")).map((row) => [
          `**${row.word}**`,
          row.other,
          `/${row.ipa}/`,
          row.syllables,
          row.meaning,
        ]),
      );
    case "sentences": {
      const ipa = args["ipa"] === "1";
      return table(
        ["#", "Kurdish", other, ...(ipa ? ["IPA"] : []), "English"],
        lines.map(([kurdish, english], index) => [
          String(index + 1),
          kurdish,
          textOther(lang, kurdish),
          ...(ipa ? [textIpa(lang, kurdish)] : []),
          english,
        ]),
      );
    }
    case "analyze":
      return table(
        ["word", "segmentation", "morpheme tags", "lemma", "features"],
        analyzeRows(lang, (args["words"] as string).split(",")).map((row) => [
          `**${row.word}**`,
          row.segmentation,
          row.gloss,
          row.lemma,
          row.features || EMPTY,
        ]),
      );
    case "ergativity":
      return table(
        ["sentence", "English", "alignment", "agent", "object", "verb agrees with", "check"],
        ergativityRows(lines).map((row) => [
          `*${row.sentence}*`,
          row.english,
          row.alignment ?? EMPTY,
          row.agent ?? EMPTY,
          row.object ?? EMPTY,
          `${row.controller ?? EMPTY} (${row.verbPerson})`,
          row.agrees ? "✔" : `✘ ${row.notes.join("; ")}`,
        ]),
      );
    case "normalize":
      return table(
        ["typed text", "after `normalize()`", "problems still found by `validate_word()`", "note"],
        normalizeRows(lang, lines).map((row) => [
          row.raw,
          row.fixed,
          row.problems.join("<br>") || EMPTY,
          row.note,
        ]),
      );
    case "alphabet":
      return lang === "ckb"
        ? table(
            [
              "letter",
              "isolated",
              "initial",
              "medial",
              "final",
              "Latin",
              "IPA",
              "joins left?",
              "example",
              "meaning",
            ],
            ckbAlphabet().map((row) => [
              `**${row.letter}**`,
              row.letter,
              row.initial,
              row.medial,
              row.final,
              row.latin ?? EMPTY,
              `/${row.ipa}/`,
              row.joins ? "yes" : "**no**",
              `${row.example} (${row.other})`,
              row.meaning,
            ]),
          )
        : table(
            ["letter", "Arabic-script equivalent", "IPA", "example", "example (Arabic script)", "meaning"],
            kmrAlphabet().map((row) => [
              `**${row.upper} ${row.letter}**`,
              row.arabic,
              `/${row.ipa}/`,
              row.example,
              row.other,
              row.meaning,
            ]),
          );
    default:
      throw new Error(`no test for ${name}`);
  }
}

/** zimankit puts one space in a table row where we build ` | `; only the spacing differs. */
const canonical = (markdown: string) =>
  markdown
    .replace(/\|---(?:\|---)*\|/g, (rule) => rule)
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");

describe.each(["ckb", "kmr"] as const)("tables for %s match zimankit's", (lang) => {
  it("has blocks to compare", () => {
    expect(fixtures[lang].length).toBeGreaterThan(50);
  });

  it.each(fixtures[lang].map((block, index) => [`${block.name} ${index}`, block] as const))(
    "%s",
    (_name, block) => {
      expect(canonical(asMarkdown(lang, block))).toBe(canonical(block.output));
    },
  );
});

describe("reference pages", () => {
  it.each(["ckb", "kmr"] as const)("%s has a page for each verb, with a name of its own", (lang) => {
    const verbs = referenceVerbs(lang);
    expect(verbs.length).toBe(lang === "ckb" ? 100 : 65);
    expect(new Set(verbs.map((verb) => verbSlug(lang, verb))).size).toBe(verbs.length);
    expect(verbIndexRows(lang)).toHaveLength(verbs.length);
  });

  it("names pages as zimankit does", () => {
    expect(verbSlug("ckb", "خواردن")).toBe("xwardin");
    expect(verbSlug("kmr", "çûn")).toBe("cun");
  });

  it("gives verbs that would share a name a page each", () => {
    expect(verbSlug("kmr", "kirin")).toBe("kirin");
    expect(verbSlug("kmr", "kirîn")).toBe("kirin-2");
  });

  it("names a verb without a page too", () => {
    expect(verbSlug("kmr", "nexşandin")).toBe("nexsandin");
  });

  it("leaves a verb's page without the sections it has no forms for", () => {
    expect(verbSections("kmr", "hatin").map((section) => section.title)).not.toContain("Passive");
    expect(verbSections("ckb", "خواردن").map((section) => section.title)).toContain("Passive");
    expect(verbSections("ckb", "هاتن").map((section) => section.title)).not.toContain("Passive");
  });

  it("lists forms without a person", () => {
    expect(verbOtherForms("ckb", "خواردن").length).toBeGreaterThan(0);
  });

  it("lists a noun's forms, leaving out those that do not exist", () => {
    expect(nounReference("ckb", "خانە").map((row) => row.label)).not.toContain("… (pl)");
    expect(nounReference("kmr", "mal").length).toBeGreaterThan(5);
    expect(nounsOf("ckb")).toContain("پیاو");
  });

  it("sorts the vocabulary by code point, as zimankit does", () => {
    const words = vocabularyRows("kmr").map((row) => row.word);
    expect(words.indexOf("av")).toBeLessThan(words.indexOf("bav"));
    expect(words.indexOf("zanîn")).toBeGreaterThan(words.indexOf("çûn") - words.length);
  });
});

describe("mistakes in the content", () => {
  it("names a word missing from the vocabulary", () => {
    expect(() => wordRows("kmr", ["nînenîne"])).toThrow("not in the vocabulary");
  });

  it("names a verb cell that does not exist", () => {
    expect(() => verbTable("kmr", "kirin", ["nope"])).toThrow("unknown verb cell");
  });

  it("names a noun cell that does not exist", () => {
    expect(() => nounTable("kmr", ["mal"], ["nope"])).toThrow("unknown noun cell");
  });

  it("builds a verb that is not in the core list", () => {
    expect(verbOf("kmr", "rabûn").infinitive).toBe("rabûn");
  });

  it("uses every cell by default", () => {
    expect(nounTable("ckb", ["پیاو"]).columns.length).toBeGreaterThan(10);
  });
});
