/** Where a lesson opens in the app. */
export const lessonRoute = (lang: string, lessonId: number, anchor: string): string =>
  `/learn/${lang}/${lessonId}${anchor ? `/${anchor}` : ""}`;

const COURSE_OF: Readonly<Record<string, string>> = { sorani: "ckb", kurmanji: "kmr" };

/** Where a link inside a lesson goes in the reader. Lessons link as pages of the website do. */
export function routeOfLessonLink(href: string, course: "ckb" | "kmr", lesson: number): string | null {
  const here = new URL(`https://x/learn/${course === "ckb" ? "sorani" : "kurmanji"}/${lesson}/`);
  const target = new URL(href, here);
  const match = /^\/learn\/(sorani|kurmanji)\/(\d\d)-[^/]*\/?$/.exec(target.pathname);
  if (match === null) return null;
  return lessonRoute(COURSE_OF[match[1] as string] as string, Number(match[2]), target.hash.slice(1));
}
