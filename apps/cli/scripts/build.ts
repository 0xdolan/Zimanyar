/**
 * Bundle the command line into one CommonJS file, which Node runs as it is and which a single
 * executable can embed, with the lexicons in a data folder beside it.
 *
 *   tsx scripts/build.ts
 */
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, "../dist");
const LEXICONS = resolve(HERE, "../../../packages/data/build");

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, "data"), { recursive: true });
const output = join(DIST, "zimanyar.cjs");
const result = await build({
  entryPoints: [resolve(HERE, "../src/main.ts")],
  outfile: output,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  banner: { js: "#!/usr/bin/env node" },
  legalComments: "none",
  // The checkout's data folder is found through import.meta only when running from source.
  logOverride: { "empty-import-meta": "silent" },
  metafile: true,
});
chmodSync(output, 0o755);
// zimanyar-lsp is the lsp command under the name editors look for.
const lsp = join(DIST, "zimanyar-lsp.cjs");
writeFileSync(lsp, '#!/usr/bin/env node\nprocess.argv.splice(2, 0, "lsp");\nrequire("./zimanyar.cjs");\n');
chmodSync(lsp, 0o755);
// Without make data the bundle still builds, and checks without lexicons; the executable needs them.
for (const lang of ["ckb", "kmr"]) {
  const lexicon = join(LEXICONS, `lexicon-${lang}.bin.gz`);
  if (existsSync(lexicon)) copyFileSync(lexicon, join(DIST, "data", `lexicon-${lang}.bin.gz`));
  else console.warn(`no ${lang} lexicon: run make data to include it`);
}
/** The licence of every package inside the bundle, read from the package itself. */
const packages = new Map<string, string>();
for (const input of Object.keys(result.metafile.inputs)) {
  const match = /^(.*node_modules\/((?:@[^/]+\/)?[^/]+))\//.exec(input.replace(/\\/g, "/"));
  if (match !== null) packages.set(match[2] as string, resolve(HERE, "..", match[1] as string));
}
const notices = [...packages]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, directory]) => {
    const { version, license } = JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as {
      version: string;
      license?: string;
    };
    const entries = readdirSync(directory);
    const file = entries.find((entry) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(entry));
    const readme = entries.find((entry) => /^readme(\.md)?$/i.test(entry));
    // An old package may state its licence only at the end of its readme.
    const text =
      file !== undefined
        ? readFileSync(join(directory, file), "utf8").trim()
        : readme !== undefined
          ? (
              /\n(licen[cs]e\n=+|#+ licen[cs]e)\n([\s\S]+)$/i.exec(
                readFileSync(join(directory, readme), "utf8"),
              )?.[2] ?? ""
            ).trim()
          : "";
    if (text === "") throw new Error(`${name} has no licence to copy`);
    return `${name} ${version} (${license ?? "see below"})\n\n${text}\n`;
  });
writeFileSync(
  join(DIST, "THIRD-PARTY-NOTICES.txt"),
  `The zimanyar command line bundles these packages. Each one's licence follows.\n\n${notices.join(`\n${"=".repeat(72)}\n\n`)}`,
);
console.log(`${packages.size} bundled packages, notices written`);
console.log(`${output}: ${(statSync(output).size / 1e6).toFixed(1)} MB`);
