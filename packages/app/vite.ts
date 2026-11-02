import mdx from "@mdx-js/rollup";
import { rehypeKurdish } from "@zimanyar/content/rehype";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import type { Plugin } from "vite";

/** What a Vite build needs for the app: the lessons compiled, and zod's eval probe gone. */
export function appPlugins(): Plugin[] {
  return [
    {
      // zod tries eval to see whether it is allowed. Under our policies that can only fail, logging a violation.
      name: "zimanyar:no-eval-probe",
      enforce: "pre",
      transform: (code, id) =>
        /zod\/.*core\/util\.js/.test(id) ? code.replace('new F("");', 'throw new Error("no eval");') : null,
    },
    {
      enforce: "pre",
      ...(mdx({
        remarkPlugins: [remarkFrontmatter, remarkGfm],
        rehypePlugins: [rehypeSlug, rehypeKurdish],
      }) as Plugin),
    },
  ];
}
