/**
 * Put what the extension serves as plain files into public/: its icons, and the lexicons from make data.
 * Without lexicons it still builds, and checks without spelling.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(APP, "../..");
const PUBLIC = resolve(APP, "public");

rmSync(PUBLIC, { recursive: true, force: true });
mkdirSync(resolve(PUBLIC, "icons"), { recursive: true });
mkdirSync(resolve(PUBLIC, "lexicons"), { recursive: true });
for (const icon of readdirSync(resolve(ROOT, "assets/icons/extension"))) {
  copyFileSync(resolve(ROOT, "assets/icons/extension", icon), resolve(PUBLIC, "icons", icon));
}
for (const lang of ["ckb", "kmr"]) {
  const lexicon = resolve(ROOT, `packages/data/build/lexicon-${lang}.bin.gz`);
  if (existsSync(lexicon)) copyFileSync(lexicon, resolve(PUBLIC, `lexicons/lexicon-${lang}.bin.gz`));
  else console.warn(`no lexicon for ${lang}: run make data for a checker with spelling`);
}
