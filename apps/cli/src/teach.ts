import type { Translate } from "@zimanyar/i18n";
import { allRuleMeta, type RuleMeta, type UiLang, type Variety } from "@zimanyar/rules";
import lessons from "../generated/lessons.json" with { type: "json" };
import { type Block, blockText, renderBlocks } from "./blocks.js";
import { lessonUrl, ruleUrl } from "./meta.js";
import type { Paint } from "./terminal.js";

export interface Lesson {
  lang: Variety;
  lesson: number;
  title: string;
  description: string;
  level: string;
  rules: string[];
  /** The lesson for the terminal, its tables computed by the engine when it was built. */
  blocks: Block[];
}

export const LESSONS = lessons as Lesson[];

export const findRule = (id: string): RuleMeta | undefined => allRuleMeta().find((meta) => meta.id === id);

/** Rule ids that start with or contain what was typed, for a suggestion after a typing mistake. */
export const similarRules = (id: string): string[] =>
  allRuleMeta()
    .map((meta) => meta.id)
    .filter((candidate) => candidate.startsWith(id) || candidate.includes(id.split(".").at(-1) ?? id))
    .slice(0, 8);

export function explainText(meta: RuleMeta, ui: UiLang, t: Translate, paint: Paint): string {
  const lines = [
    paint.bold(meta.id),
    t("cli.explain.kind", {
      category: t(`category.${meta.category}`),
      severity: t(`severity.${meta.severity}`),
      lang: meta.lang === "any" ? t("cli.explain.anyLang") : t(`lang.${meta.lang}`),
    }),
    "",
    meta.message[ui],
    "",
    meta.reason[ui],
  ];
  if (meta.examples.length > 0) {
    lines.push("", paint.bold(t("cli.explain.examples")));
    for (const example of meta.examples) {
      lines.push(
        `  ${paint.red(example.wrong)}  →  ${paint.green(example.right)}${example.gloss ? `  ${paint.dim(example.gloss)}` : ""}`,
      );
    }
  }
  if (meta.safeFix) lines.push("", t("cli.explain.safe"));
  if (meta.lessons.length > 0) {
    lines.push("", paint.bold(t("cli.explain.lessons")));
    for (const lesson of meta.lessons) {
      lines.push(
        `  ${lesson.title.replace(/^\d+\.\s*/, "")}  ${paint.dim(`zimanyar lesson ${lesson.lessonId} --lang ${lesson.lang}`)}`,
      );
    }
  }
  lines.push("", paint.dim(ruleUrl(meta.id)));
  return lines.join("\n");
}

const fold = (text: string) => text.toLocaleLowerCase("en").normalize("NFC");

/**
 * The lessons a topic names: a lesson number, a rule id, or words in the title, then in the text.
 * A course narrows the search.
 */
export function findLessons(topic: string, lang: Variety | undefined): Lesson[] {
  const pool = LESSONS.filter((lesson) => lang === undefined || lesson.lang === lang);
  if (/^\d+$/.test(topic)) return pool.filter((lesson) => lesson.lesson === Number(topic));
  const rule = findRule(topic);
  if (rule !== undefined) {
    return pool.filter((lesson) =>
      rule.lessons.some((ref) => ref.lang === lesson.lang && ref.lessonId === lesson.lesson),
    );
  }
  const words = fold(topic).split(/\s+/).filter(Boolean);
  const inTitle = pool.filter((lesson) => words.every((word) => fold(lesson.title).includes(word)));
  if (inTitle.length > 0) return inTitle;
  return pool.filter((lesson) => {
    const text = fold(lesson.blocks.map(blockText).join(" "));
    return words.every((word) => text.includes(word));
  });
}

function levelName(level: string, t: Translate): string {
  if (level === "beginner") return t("cli.lesson.beginner");
  if (level === "intermediate") return t("cli.lesson.intermediate");
  if (level === "advanced") return t("cli.lesson.advanced");
  return level;
}

export function lessonList(found: readonly Lesson[], t: Translate, paint: Paint): string {
  return found
    .map(
      (lesson) =>
        `${paint.dim(`${lesson.lang} ${String(lesson.lesson).padStart(2)}`)}  ${lesson.title.replace(/^\d+\.\s*/, "")}  ${paint.dim(
          levelName(lesson.level, t),
        )}`,
    )
    .join("\n");
}

export function lessonText(lesson: Lesson, paint: Paint): string {
  return [
    paint.bold(lesson.title),
    "",
    renderBlocks(lesson.blocks, paint),
    "",
    paint.dim(lessonUrl({ lang: lesson.lang, lessonId: lesson.lesson })),
  ].join("\n");
}
