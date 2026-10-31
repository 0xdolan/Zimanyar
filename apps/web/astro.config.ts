import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { COURSE_PATH } from "@zimanyar/content/lesson-slugs";
import { rehypeKurdish } from "@zimanyar/content/rehype";
import { createT, type MessageKey } from "@zimanyar/i18n";
import { defineConfig } from "astro/config";

const WEB = dirname(fileURLToPath(import.meta.url));
const LESSONS = resolve(WEB, "../../packages/content/lessons");
const BASE = "/Zimanyar";

const t = { ckb: createT("ckb"), kmr: createT("kmr"), en: createT("en") };
/** A sidebar label in English, with its translations. */
const named = (key: MessageKey) => ({
  label: t.en(key),
  translations: { ckb: t.ckb(key), kmr: t.kmr(key) },
});

interface Lesson {
  slug: string;
  title: string;
  lesson: number;
  level: string;
}

function lessonsOf(course: "ckb" | "kmr"): Lesson[] {
  const folder = resolve(LESSONS, course);
  return readdirSync(folder)
    .filter((file) => /^\d\d-/.test(file))
    .map((file) => {
      const text = readFileSync(resolve(folder, file), "utf8");
      const field = (name: string) => new RegExp(`^${name}: (.+)$`, "m").exec(text)?.[1] ?? "";
      return {
        slug: `learn/${COURSE_PATH[course]}/${file.replace(/\.mdx$/, "")}`,
        title: JSON.parse(field("title")) as string,
        lesson: Number(field("lesson")),
        level: field("level"),
      };
    })
    .sort((a, b) => a.lesson - b.lesson);
}

function courseSidebar(course: "ckb" | "kmr", key: MessageKey) {
  const lessons = lessonsOf(course);
  const group = (level: string, name: MessageKey, collapsed: boolean) => ({
    ...named(name),
    collapsed,
    items: lessons
      .filter((lesson) => lesson.level === level)
      .map((lesson) => ({ label: lesson.title, slug: lesson.slug })),
  });
  return {
    ...named(key),
    items: [
      { ...named("nav.courseHome"), slug: `learn/${COURSE_PATH[course]}` },
      group("beginner", "nav.beginner", false),
      group("intermediate", "nav.intermediate", false),
      group("advanced", "nav.advanced", false),
      {
        ...named("nav.reference"),
        items: [
          { ...named("nav.cheatSheet"), slug: `learn/${COURSE_PATH[course]}/cheat-sheet` },
          { ...named("nav.verbs"), slug: `learn/${COURSE_PATH[course]}/verbs` },
          { ...named("nav.nouns"), slug: `learn/${COURSE_PATH[course]}/nouns` },
          { ...named("nav.vocabulary"), slug: `learn/${COURSE_PATH[course]}/vocabulary` },
        ],
      },
    ],
  };
}

export default defineConfig({
  site: "https://0xdolan.github.io",
  base: BASE,
  trailingSlash: "always",
  integrations: [
    starlight({
      title: "Zimanyar",
      logo: { src: "../../assets/brand/logo.svg" },
      favicon: "/favicon.svg",
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
        ckb: { label: "کوردی سۆرانی", lang: "ckb", dir: "rtl" },
        kmr: { label: "Kurmancî", lang: "kmr" },
      },
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/0xdolan/Zimanyar" }],
      customCss: ["./src/styles/site.css"],
      routeMiddleware: "./src/route-data.ts",
      components: { Header: "./src/components/Header.astro", PageTitle: "./src/components/PageTitle.astro" },
      expressiveCode: false,
      head: [
        {
          tag: "script",
          content: `if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("${BASE}/sw.js", { scope: "${BASE}/" }).catch(() => {}));`,
        },
      ],
      sidebar: [
        courseSidebar("ckb", "nav.learnCkb"),
        courseSidebar("kmr", "nav.learnKmr"),
        {
          ...named("nav.docs"),
          items: [
            { ...named("nav.docsHome"), slug: "docs" },
            { ...named("nav.userGuide"), items: [{ autogenerate: { directory: "docs/user" } }] },
            { ...named("nav.devGuide"), items: [{ autogenerate: { directory: "docs/dev" } }] },
          ],
        },
      ],
    }),
    react(),
  ],
  markdown: { rehypePlugins: [rehypeKurdish] },
  vite: {
    plugins: [tailwindcss()],
    ssr: { noExternal: [/^@zimanyar\//, "radix-ui", /^@radix-ui\//] },
    worker: { format: "es" },
    server: { fs: { allow: ["../.."] } },
    define: {
      "import.meta.env.PUBLIC_DATA_VERSION": JSON.stringify(
        /^sha256=(\w{12})/m.exec(readFileSync(resolve(WEB, "../../packages/data/VERSION"), "utf8"))?.[1] ??
          "dev",
      ),
    },
  },
});
