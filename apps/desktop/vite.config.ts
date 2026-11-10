import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { appPlugins } from "@zimanyar/app/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [...appPlugins(), react({ include: /\.(tsx|mdx)$/ }), tailwindcss()],
  worker: { format: "es" },
  define: { __APP_VERSION__: JSON.stringify(process.env["npm_package_version"] ?? "1.1.0") },
  clearScreen: false,
  build: {
    // Fonts small enough sit inside the stylesheet, which the overlay's closed shadow root can use.
    assetsInlineLimit: 30_000,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        settings: resolve(import.meta.dirname, "settings.html"),
        quick: resolve(import.meta.dirname, "quick.html"),
      },
    },
  },
  server: { port: 1420, strictPort: true },
});
