import { lessonPath } from "@zimanyar/content/lesson-slugs";
import type { LessonRef } from "@zimanyar/rules";
import meta from "../generated/meta.json" with { type: "json" };

export const VERSION: string = meta.version;
export const DATA_VERSION: string = meta.data;
export const ZIMANKIT_VERSION: string = meta.zimankit;

export const SITE = "https://0xdolan.github.io/Zimanyar/";

/** A lesson's address on the website. The command line itself never opens it. */
export const lessonUrl = (lesson: Pick<LessonRef, "lang" | "lessonId">): string =>
  SITE + lessonPath(lesson.lang, lesson.lessonId);

/** A rule's page on the website. */
export const ruleUrl = (id: string): string => `${SITE}rules/${id}/`;
