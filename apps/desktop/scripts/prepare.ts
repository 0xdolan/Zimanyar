/**
 * Put what the app and its packages need in place: the lexicons from make data, and files a Debian package
 * must hold compressed. Without lexicons the app still builds, and checks without spelling.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(APP, "../..");
const PUBLIC = resolve(APP, "public");
const GENERATED = resolve(APP, "src-tauri/generated");

rmSync(PUBLIC, { recursive: true, force: true });
mkdirSync(resolve(PUBLIC, "lexicons"), { recursive: true });
for (const lang of ["ckb", "kmr"]) {
  const lexicon = resolve(ROOT, `packages/data/build/lexicon-${lang}.bin.gz`);
  if (existsSync(lexicon)) copyFileSync(lexicon, resolve(PUBLIC, `lexicons/lexicon-${lang}.bin.gz`));
  else console.warn(`no lexicon for ${lang}: run make data for a checker with spelling`);
}

mkdirSync(GENERATED, { recursive: true });
// mtime 0, so that the same sources make the same package.
const gzipped = (from: string, to: string) =>
  writeFileSync(resolve(GENERATED, to), gzipSync(readFileSync(resolve(ROOT, from)), { level: 9 }));
gzipped("packaging/linux/zimanyar-desktop.1", "zimanyar-desktop.1.gz");
gzipped("packaging/linux/changelog", "changelog.gz");
