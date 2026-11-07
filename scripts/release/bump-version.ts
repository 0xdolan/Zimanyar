/**
 * Set the shared product version in every manifest (PRD section 17.2): each
 * package.json, the desktop Cargo.toml, Cargo.lock and tauri.conf.json, both
 * Debian changelogs, the AppStream release list, pyproject.toml and uv.lock.
 * The data version (packages/data/VERSION) is separate and left alone.
 *
 *   tsx scripts/release/bump-version.ts 1.0.0 ["note for the changelogs"]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const MAINTAINER = "Dolan H. <0xdolan@gmail.com>";

export interface Release {
  version: string;
  /** One sentence for the Debian changelogs and the AppStream entry. */
  note: string;
  date: Date;
}

/** RFC 2822 date as Debian changelogs want it. */
export function debianDate(date: Date): string {
  return date.toUTCString().replace("GMT", "+0000");
}

function replaceOnce(text: string, pattern: RegExp, version: string, file: string): string {
  if (!pattern.test(text)) throw new Error(`${file}: no version found`);
  return text.replace(pattern, (_match, before: string, after: string) => `${before}${version}${after}`);
}

function debianChangelog(text: string, release: Release, file: string): string {
  const head = /^(\S+) \(([^)]+)\)/.exec(text);
  if (head === null) throw new Error(`${file}: no changelog entry found`);
  if (head[2] === release.version) return text;
  const entry = [
    `${head[1]} (${release.version}) unstable; urgency=medium`,
    "",
    `  * ${release.note}`,
    "",
    ` -- ${MAINTAINER}  ${debianDate(release.date)}`,
    "",
    "",
  ].join("\n");
  return entry + text;
}

function appStream(text: string, release: Release, file: string): string {
  if (!text.includes("<releases>")) throw new Error(`${file}: no <releases> list found`);
  if (text.includes(`<release version="${release.version}"`)) return text;
  const day = release.date.toISOString().slice(0, 10);
  const entry = [
    `    <release version="${release.version}" date="${day}">`,
    "      <description>",
    `        <p>${release.note.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`,
    "      </description>",
    "    </release>",
  ].join("\n");
  return text.replace("<releases>\n", `<releases>\n${entry}\n`);
}

/** The new contents of one versioned file. Throws when the file does not have the expected shape. */
export function bump(file: string, text: string, release: Release): string {
  const { version } = release;
  if (file.endsWith("package.json") || file.endsWith("tauri.conf.json")) {
    return replaceOnce(text, /^(\s*"version": ")[^"]+(")/m, version, file);
  }
  if (file.endsWith("Cargo.toml") || file === "pyproject.toml") {
    return replaceOnce(text, /^(version = ")[^"]+(")/m, version, file);
  }
  if (file.endsWith("Cargo.lock")) {
    return replaceOnce(text, /^(name = "zimanyar-desktop"\nversion = ")[^"]+(")/m, version, file);
  }
  if (file === "uv.lock") {
    return replaceOnce(text, /^(name = "zimanyar-data"\nversion = ")[^"]+(")/m, version, file);
  }
  if (file.endsWith("vite.config.ts")) {
    return replaceOnce(text, /(npm_package_version"\] \?\? ")[^"]+(")/, version, file);
  }
  if (file.endsWith("changelog")) return debianChangelog(text, release, file);
  if (file.endsWith(".metainfo.xml")) return appStream(text, release, file);
  throw new Error(`${file}: not a versioned file`);
}

export const FIXED_FILES = [
  "apps/desktop/src-tauri/Cargo.toml",
  "apps/desktop/src-tauri/Cargo.lock",
  "apps/desktop/src-tauri/tauri.conf.json",
  "apps/desktop/vite.config.ts",
  "debian/changelog",
  "packaging/linux/changelog",
  "packaging/linux/io.github._0xdolan.Zimanyar.metainfo.xml",
  "pyproject.toml",
  "uv.lock",
];

const trackedPackageJsons = () =>
  execFileSync("git", ["ls-files", "*package.json"], { encoding: "utf8" }).split("\n").filter(Boolean);

export function main(
  args: string[] = process.argv.slice(2),
  listPackageJsons: () => string[] = trackedPackageJsons,
  read: (file: string) => string = (file) => readFileSync(file, "utf8"),
  write: (file: string, text: string) => void = (file, text) => writeFileSync(file, text),
  now: Date = new Date(),
): number {
  const [version, note] = args;
  if (version === undefined || !SEMVER.test(version)) {
    console.error("usage: bump-version.ts X.Y.Z [note]");
    return 2;
  }
  const release: Release = { version, note: note ?? `Version ${version}.`, date: now };
  const files = [...listPackageJsons(), ...FIXED_FILES];
  // Work out every change before writing any, so a broken file leaves the tree untouched.
  const changes: [string, string][] = [];
  try {
    for (const file of files) {
      const before = read(file);
      const after = bump(file, before, release);
      if (after !== before) changes.push([file, after]);
    }
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }
  for (const [file, text] of changes) write(file, text);
  console.log(`version ${version}: ${changes.length} of ${files.length} files changed`);
  return 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
