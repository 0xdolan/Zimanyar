import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** A page of the components with real findings, for browser tests and screenshots. */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist", emptyOutDir: true },
});
