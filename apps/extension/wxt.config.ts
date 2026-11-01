import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import { rehypeKurdish } from "@zimanyar/content/rehype";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { defineConfig } from "wxt";

/** A test build may reach localhost without asking, as a browser test cannot press Allow. */
const E2E = process.env["ZIMANYAR_E2E"] === "1";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  webExt: { disabled: true },
  ...(E2E ? { outDirTemplate: "e2e-{{browser}}-mv{{manifestVersion}}" } : {}),
  manifest: ({ browser }) => ({
    name: "Zimanyar",
    description: "Check and learn Kurdish as you write, in Sorani and Kurmanji. Nothing leaves your device.",
    homepage_url: "https://0xdolan.github.io/Zimanyar/",
    permissions: [
      "storage",
      "activeTab",
      "scripting",
      "contextMenus",
      ...(browser === "chrome" ? ["sidePanel"] : []),
    ],
    optional_host_permissions: ["<all_urls>"],
    ...(E2E ? { host_permissions: ["http://localhost/*"] } : {}),
    // connect-src reaches only the extension's own files, which is how the lexicons load: nothing goes out.
    content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'; connect-src 'self'" },
    icons: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      96: "icons/icon-96.png",
      128: "icons/icon-128.png",
    },
    action: { default_title: "Zimanyar" },
    commands: {
      "toggle-site": { description: "Turn Zimanyar on or off for this site" },
      "next-finding": { description: "Go to the next finding", suggested_key: { default: "Alt+Shift+N" } },
      "previous-finding": {
        description: "Go to the previous finding",
        suggested_key: { default: "Alt+Shift+P" },
      },
      "apply-first": { description: "Apply the first suggestion", suggested_key: { default: "Alt+Shift+F" } },
    },
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "zimanyar@0xdolan.github.io",
              strict_min_version: "142.0",
              data_collection_permissions: { required: ["none"] },
            },
          },
        }
      : {}),
  }),
  vite: () => ({
    plugins: [
      {
        // zod tries eval to see whether it is allowed. Under our policy that can only fail, logging a violation.
        name: "zimanyar:no-eval-probe",
        enforce: "pre",
        transform: (code: string, id: string) =>
          /zod\/.*core\/util\.js/.test(id) ? code.replace('new F("");', 'throw new Error("no eval");') : null,
      },
      {
        enforce: "pre",
        ...mdx({
          remarkPlugins: [remarkFrontmatter, remarkGfm],
          rehypePlugins: [rehypeSlug, rehypeKurdish],
        }),
      },
      tailwindcss(),
    ],
    // Fonts small enough sit inside the stylesheet, as a page's policy may refuse a file from an extension.
    build: { assetsInlineLimit: 30_000, modulePreload: { polyfill: false } },
    define: { __ZIMANYAR_E2E__: JSON.stringify(E2E) },
  }),
});
