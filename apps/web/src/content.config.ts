import { defineCollection, z } from "astro:content";
import { docsSchema, i18nSchema } from "@astrojs/starlight/schema";
import { COURSE_PATH } from "@zimanyar/content/lesson-slugs";
import { catalogueOf } from "@zimanyar/i18n";
import { glob } from "astro/loaders";

const PAGES = "apps/web/src/content/docs/";
const LESSONS = "packages/content/lessons/";

/** The site's own pages, and the course from the package that holds it. */
function idOf(entry: string): string {
  const path = entry.startsWith(LESSONS)
    ? `learn/${entry.slice(LESSONS.length).replace(/^ckb/, COURSE_PATH.ckb).replace(/^kmr/, COURSE_PATH.kmr)}`
    : entry.slice(PAGES.length);
  return path.replace(/\.mdx?$/, "").replace(/(^|\/)index$/, "") || "index";
}

/** Starlight's own strings, from the same catalogues as every other string. */
function starlightStrings(lang: "ckb" | "kmr") {
  const entries = Object.entries(catalogueOf(lang)).flatMap(([key, value]) =>
    key.startsWith("starlight.") ? [[key.slice("starlight.".length), value]] : [],
  );
  return { id: lang, ...Object.fromEntries(entries) };
}

export const collections = {
  docs: defineCollection({
    loader: glob({
      base: "../..",
      pattern: [`${PAGES}**/[^_]*.{md,mdx}`, `${LESSONS}**/*.mdx`],
      generateId: ({ entry }) => idOf(entry),
    }),
    schema: docsSchema({
      extend: z.object({
        course: z.enum(["ckb", "kmr"]).optional(),
        lesson: z.number().optional(),
        level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        rules: z.array(z.string()).optional(),
      }),
    }),
  }),
  i18n: defineCollection({
    loader: () => [starlightStrings("ckb"), starlightStrings("kmr")],
    schema: i18nSchema(),
  }),
};
