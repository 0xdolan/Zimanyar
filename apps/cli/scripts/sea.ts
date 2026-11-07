/**
 * Make the single executable: Node with the bundle and the lexicons inside, for the .deb and the
 * tarball, where no Node may be installed. Run after the build.
 *
 *   tsx scripts/sea.ts [output]
 *
 * postject, which writes the bundle into the copy of Node, runs through pnpm dlx at an exact version,
 * so it never enters the lockfile or the shipped program.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, "../dist");
const output = resolve(process.argv[2] ?? join(DIST, "zimanyar"));
const config = join(DIST, "sea-config.json");
const blob = join(DIST, "sea.blob");

for (const lang of ["ckb", "kmr"]) {
  if (!existsSync(join(DIST, "data", `lexicon-${lang}.bin.gz`))) {
    throw new Error(`the ${lang} lexicon is missing: run make data, then the build`);
  }
}
writeFileSync(
  config,
  JSON.stringify({
    main: join(DIST, "zimanyar.cjs"),
    output: blob,
    disableExperimentalSEAWarning: true,
    useCodeCache: true,
    assets: Object.fromEntries(
      ["ckb", "kmr"].map((lang) => [`lexicon-${lang}.bin.gz`, join(DIST, "data", `lexicon-${lang}.bin.gz`)]),
    ),
  }),
);
execFileSync(process.execPath, ["--experimental-sea-config", config], { stdio: "inherit" });
rmSync(output, { force: true });
copyFileSync(process.execPath, output);
chmodSync(output, 0o755);
// Node is released with its symbols. Stripped before the bundle goes in, it is smaller, and the
// package's tools can leave it as it is.
execFileSync("strip", ["--strip-all", output], { stdio: "inherit" });
execFileSync(
  "pnpm",
  [
    "dlx",
    "postject@1.0.0-alpha.6",
    output,
    "NODE_SEA_BLOB",
    blob,
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  ],
  { stdio: "inherit" },
);
rmSync(blob);
rmSync(config);
console.log(`${output}: ${(statSync(output).size / 1e6).toFixed(0)} MB`);
