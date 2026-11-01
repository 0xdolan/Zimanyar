import { createT, type UiLang } from "@zimanyar/i18n";
import lessons from "@zimanyar/rules/lessons.json";
import { Button } from "@zimanyar/ui";
import { type ComponentType, type MouseEvent, useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { routeOfLessonLink } from "../lib/messages";

type Course = "ckb" | "kmr";
const index = lessons as Record<Course, Record<string, { file: string; title: string }>>;

/** Lessons load one at a time, compiled when the extension is built. */
const MODULES = import.meta.glob<{ default: ComponentType }>(
  "../../../../packages/content/lessons/*/[0-9]*.mdx",
);

const moduleOf = (course: Course, lesson: number) => {
  const slug = index[course]?.[String(lesson)]?.file.split("/").at(-1)?.replace(".md", "");
  return MODULES[`../../../../packages/content/lessons/${course}/${slug}.mdx`];
};

function LessonLinks({ course, lang }: { course: Course; lang: UiLang }) {
  const t = createT(lang);
  return (
    <ol className="flex flex-col gap-1">
      {Object.entries(index[course]).map(([number, { title }]) => (
        <li key={number}>
          <a className="hover:underline" href={`#/learn/${course}/${number}`}>
            <span dir="auto">
              {number}. {title}
            </span>
          </a>
        </li>
      ))}
      <li className="sr-only">{t("learn.contents")}</li>
    </ol>
  );
}

/** The courses inside the extension, so that a finding's lesson opens with no network. */
export function LessonReader({ lang, route }: { lang: UiLang; route: string }) {
  const t = createT(lang);
  const [, , courseName, number, anchor] = route.split("/");
  const course: Course = courseName === "kmr" ? "kmr" : "ckb";
  const lesson = Number(number);
  const [Content, setContent] = useState<ComponentType | null>(null);
  const article = useRef<HTMLElement>(null);

  useEffect(() => {
    setContent(null);
    const load = number === undefined ? undefined : moduleOf(course, lesson);
    if (load !== undefined) void load().then((module) => setContent(() => module.default));
  }, [course, lesson, number]);

  useEffect(() => {
    if (Content !== null && anchor)
      article.current?.querySelector(`[id="${CSS.escape(anchor)}"]`)?.scrollIntoView();
  }, [Content, anchor]);

  const onClick = (event: MouseEvent) => {
    const link = (event.target as Element).closest("a");
    const href = link?.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    event.preventDefault();
    if (/^https:\/\//.test(href)) {
      void browser.tabs.create({ url: href });
      return;
    }
    const next = routeOfLessonLink(href, course, lesson);
    if (next !== null) location.hash = next;
  };

  const title = index[course]?.[String(lesson)]?.title;
  const [previous, next] = [lesson - 1, lesson + 1];

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Button
            onClick={() => {
              location.hash = "/learn/ckb";
            }}
            size="sm"
            variant={course === "ckb" ? "default" : "outline"}
          >
            {t("lang.ckb")}
          </Button>
          <Button
            onClick={() => {
              location.hash = "/learn/kmr";
            }}
            size="sm"
            variant={course === "kmr" ? "default" : "outline"}
          >
            {t("lang.kmr")}
          </Button>
        </div>
        <LessonLinks course={course} lang={lang} />
      </aside>
      {number === undefined ? (
        <p className="text-muted-foreground">{t("learn.lead")}</p>
      ) : (
        // biome-ignore lint/a11y/useKeyWithClickEvents: only catches clicks on the links inside, which have their own keys
        <article className="zy-lesson" lang="en" dir="ltr" onClick={onClick} ref={article}>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {Content !== null && <Content />}
          <nav className="mt-8 flex justify-between gap-2" aria-label={t("learn.contents")}>
            {previous >= 1 && (
              <a href={`#/learn/${course}/${previous}`}>{t("starlight.page.previousLink")}</a>
            )}
            {next <= 23 && <a href={`#/learn/${course}/${next}`}>{t("starlight.page.nextLink")}</a>}
          </nav>
        </article>
      )}
    </div>
  );
}
