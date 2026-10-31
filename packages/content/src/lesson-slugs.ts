import slugs from "./lesson-slugs.json" with { type: "json" };

type Course = "ckb" | "kmr";

/**
 * A course's address. Not its language code: Astro takes a code anywhere in a path for the interface
 * language, so /learn/ckb/ in the English site would get Sorani menus.
 */
export const COURSE_PATH: Record<Course, string> = { ckb: "sorani", kmr: "kurmanji" };

/** A lesson's address, small enough to send to a browser, unlike the rest of this package. */
export function lessonPath(lang: Course, lesson: number): string {
  return `learn/${COURSE_PATH[lang]}/${(slugs as Record<string, Record<string, string>>)[lang]?.[String(lesson)] ?? ""}/`;
}
