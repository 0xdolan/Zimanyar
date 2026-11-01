import { z } from "zod";

/** Messages other than checking, which the checker's own protocol validates. */
const lesson = z.object({
  lang: z.enum(["ckb", "kmr"]),
  lessonId: z.number().int().min(1).max(23),
  anchor: z.string().max(200),
});

export const toBackground = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("open-lesson"), lesson }),
  z.object({ kind: z.literal("open-app"), route: z.string().max(200) }),
]);

export const toContent = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("status") }),
  z.object({ kind: z.literal("stop") }),
  z.object({ kind: z.literal("next-finding") }),
  z.object({ kind: z.literal("previous-finding") }),
  z.object({ kind: z.literal("apply-first") }),
]);

export interface PageStatus {
  /** Findings in the field last used. */
  count: number;
  /** The language most of them are in, or null with no field or findings. */
  lang: string | null;
}

/** The checker's requests a page may make. Loading a lexicon is the background's own business. */
const CHECKER_REQUESTS = new Set(["check", "fixSafe", "suggest", "complete"]);
export const isCheckerRequest = (message: unknown): message is { type: string } =>
  typeof message === "object" &&
  message !== null &&
  CHECKER_REQUESTS.has((message as { type?: unknown }).type as string);

const scriptOf = (text: string): "ckb" | "kmr" => (/\p{Script=Arabic}/u.test(text) ? "ckb" : "kmr");

/** The lexicons a request needs. Automatic detection may meet both scripts in one text. */
export function lexiconsFor(request: {
  type: string;
  text?: unknown;
  lang?: unknown;
  options?: { lang?: unknown };
}): ("ckb" | "kmr")[] {
  if (request.lang === "ckb" || request.lang === "kmr") return [request.lang];
  const chosen = request.options?.lang;
  if (chosen === "ckb" || chosen === "kmr") return [chosen];
  if (typeof request.text !== "string") return [];
  const hasArabic = scriptOf(request.text) === "ckb";
  const hasLatin = /\p{Script=Latin}/u.test(request.text);
  return [...(hasArabic ? (["ckb"] as const) : []), ...(hasLatin || !hasArabic ? (["kmr"] as const) : [])];
}

/** Where a lesson opens in the full view. */
export const lessonRoute = (lang: string, lessonId: number, anchor: string): string =>
  `/learn/${lang}/${lessonId}${anchor ? `/${anchor}` : ""}`;

/** The origin a Zimanyar site permission covers, or null for pages it cannot run on. */
export function originOf(url: string | undefined): string | null {
  if (url === undefined) return null;
  try {
    const { protocol, origin } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? origin : null;
  } catch {
    return null;
  }
}

/** A pattern for a site's permission. Patterns have no ports: a port would make the browser refuse it. */
export function matchPatternOf(origin: string): string {
  const { protocol, hostname } = new URL(origin);
  return `${protocol}//${hostname}/*`;
}

const COURSE_OF: Readonly<Record<string, string>> = { sorani: "ckb", kurmanji: "kmr" };

/** Where a link inside a lesson goes in the reader. Lessons link as pages of the website do. */
export function routeOfLessonLink(href: string, course: "ckb" | "kmr", lesson: number): string | null {
  const here = new URL(`https://x/learn/${course === "ckb" ? "sorani" : "kurmanji"}/${lesson}/`);
  const target = new URL(href, here);
  const match = /^\/learn\/(sorani|kurmanji)\/(\d\d)-[^/]*\/?$/.exec(target.pathname);
  if (match === null) return null;
  return lessonRoute(COURSE_OF[match[1] as string] as string, Number(match[2]), target.hash.slice(1));
}
