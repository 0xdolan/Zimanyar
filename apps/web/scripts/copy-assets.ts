/**
 * Put what the site serves as plain files into public/. Lexicons come from make data, and are left out
 * when it has not run: the checker then works without spelling.
 */
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(WEB, "../..");
const PUBLIC = resolve(WEB, "public");

rmSync(resolve(PUBLIC, "lexicons"), { recursive: true, force: true });
mkdirSync(resolve(PUBLIC, "lexicons"), { recursive: true });
copyFileSync(resolve(ROOT, "assets/brand/logo-favicon.svg"), resolve(PUBLIC, "favicon.svg"));
for (const lang of ["ckb", "kmr"]) {
  const lexicon = resolve(ROOT, `packages/data/build/lexicon-${lang}.bin.gz`);
  if (existsSync(lexicon)) copyFileSync(lexicon, resolve(PUBLIC, `lexicons/lexicon-${lang}.bin.gz`));
  else console.warn(`no lexicon for ${lang}: run make data for a checker with spelling`);
}
