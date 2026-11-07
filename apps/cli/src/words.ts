import { pronounce, transliterate } from "@zimanyar/app/writing";
import {
  declension,
  personsOf,
  VOCABULARY,
  verbCell,
  verbCellTitle,
  verbOf,
  verbOtherForms,
  verbSections,
} from "@zimanyar/content";
import {
  type Analysis,
  ckb,
  gloss,
  identify,
  kmr,
  lexiconAdapter,
  normalize,
  segmentation,
} from "@zimanyar/core";
import type { Translate } from "@zimanyar/i18n";
import type { Variety } from "@zimanyar/rules";
import { lexiconFor } from "./data.js";
import { type Paint, table } from "./terminal.js";

export const varietyOf = (text: string, lang: Variety | "auto"): Variety =>
  lang !== "auto" ? lang : /\p{Script=Arabic}/u.test(text) ? "ckb" : "kmr";

type Env = Readonly<Record<string, string | undefined>>;

/** Every reading of a word, best first, with the lexicon when it is installed. */
export async function readingsOf(word: string, lang: Variety, env: Env): Promise<Analysis[]> {
  const lexicon = await lexiconFor(lang, env);
  const adapter = lexicon === null ? undefined : lexiconAdapter(lexicon);
  const analyzer = lang === "ckb" ? new ckb.CkbAnalyzer(adapter) : new kmr.KmrAnalyzer(adapter);
  return analyzer.analyze(word);
}

export function readingsTable(readings: readonly Analysis[], t: Translate, paint: Paint): string {
  if (readings.length === 0) return t("cli.analyze.none");
  return table(
    [
      t("cli.analyze.lemma"),
      t("cli.analyze.pos"),
      t("cli.analyze.parts"),
      t("cli.analyze.gloss"),
      t("cli.analyze.features"),
    ],
    readings.map((reading) => [
      reading.lemma,
      reading.pos,
      segmentation(reading),
      gloss(reading),
      Object.entries(reading.features)
        .map(([key, value]) => `${key}=${value}`)
        .join(" "),
    ]),
    paint,
  );
}

export interface Paradigm {
  infinitive: string;
  lang: Variety;
  present: string;
  past: string;
  transitive: boolean;
  sections: {
    title: string;
    columns: string[];
    rows: { person: string; pronoun: string; forms: (string | null)[] }[];
  }[];
  other: [label: string, form: string][];
}

/** A verb's whole paradigm. A verb that is not in the core list is built from its infinitive. */
export function paradigmOf(infinitive: string, lang: Variety): Paradigm {
  const verb = verbOf(lang, infinitive);
  return {
    infinitive,
    lang,
    present: verb.present,
    past: verb.past,
    transitive: verb.transitive,
    sections: verbSections(lang, infinitive).map(({ title, cells }) => {
      const data = cells.map((cell) => verbCell(lang, verb, cell));
      return {
        title,
        columns: cells.map((cell) => verbCellTitle(lang, cell)),
        rows: personsOf(lang)
          .filter(([person]) => data.some((cell) => person in cell))
          .map(([person, pronoun]) => ({ person, pronoun, forms: data.map((cell) => cell[person] ?? null) })),
      };
    }),
    other: verbOtherForms(lang, infinitive),
  };
}

export function paradigmText(paradigm: Paradigm, t: Translate, paint: Paint): string {
  const blocks = [
    paint.bold(paradigm.infinitive),
    t("cli.conjugate.stems", {
      present: paradigm.present,
      past: paradigm.past,
      kind: paradigm.transitive ? t("cli.conjugate.transitive") : t("cli.conjugate.intransitive"),
    }),
  ];
  for (const section of paradigm.sections) {
    blocks.push(
      "",
      paint.bold(section.title),
      table(
        ["", ...section.columns],
        section.rows.map((row) => [
          `${row.pronoun} (${row.person})`,
          ...row.forms.map((form) => form ?? "-"),
        ]),
        paint,
      ),
    );
  }
  if (paradigm.other.length > 0) {
    blocks.push("", table([t("cli.conjugate.form"), ""], paradigm.other, paint));
  }
  return blocks.join("\n");
}

/** The genders to decline a Kurmanji noun in: the one given, the lexicon's, the lessons', or both. */
export async function gendersOf(
  noun: string,
  lang: Variety,
  given: "f" | "m" | undefined,
  env: Env,
): Promise<("f" | "m")[]> {
  if (lang === "ckb") return ["m"];
  if (given !== undefined) return [given];
  const lexicon = await lexiconFor(lang, env);
  const known = lexicon === null ? null : lexiconAdapter(lexicon).genderOf(noun);
  const note = known ?? VOCABULARY.kmr[noun]?.[1] ?? null;
  return note === "f" || note === "m" ? [note] : ["f", "m"];
}

export function declensionText(
  noun: string,
  lang: Variety,
  genders: readonly ("f" | "m")[],
  t: Translate,
  paint: Paint,
): string {
  return genders
    .map((gender) => {
      const title =
        lang === "kmr"
          ? `${paint.bold(noun)} (${gender === "f" ? t("cli.decline.feminine") : t("cli.decline.masculine")})`
          : paint.bold(noun);
      const rows = declension(lang, noun, gender).map(({ label, form }) => [label, form]);
      return `${title}\n${table([t("cli.decline.cell"), t("cli.decline.form")], rows, paint)}`;
    })
    .join("\n\n");
}

export const ipaOf = (text: string): string => pronounce(text);
export const translitOf = (text: string): string => transliterate(text);
export const normalizedOf = (text: string, lang: Variety): string => normalize(text, lang);

export function lidText(text: string, t: Translate): string {
  const result = identify(text);
  const scores = Object.entries(result.scores)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, score]) => `${lang} ${score.toFixed(2)}`)
    .join(", ");
  return [
    t("cli.lid.result", {
      lang: result.lang,
      script: result.script,
      confidence: result.confidence.toFixed(2),
    }),
    ...(scores !== "" ? [t("cli.lid.scores", { scores })] : []),
  ].join("\n");
}
