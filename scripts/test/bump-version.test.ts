import { afterEach, describe, expect, it, vi } from "vitest";
import { bump, debianDate, FIXED_FILES, main, type Release } from "../release/bump-version.js";

const release: Release = {
  version: "1.0.0",
  note: "The first stable version.",
  date: new Date("2026-11-07T12:00:00Z"),
};

describe("bump", () => {
  it("changes only the top-level version of a package.json", () => {
    const text =
      '{\n  "name": "x",\n  "version": "0.1.0",\n  "dependencies": { "a": { "version": "2.0.0" } }\n}\n';
    expect(bump("apps/cli/package.json", text, release)).toBe(text.replace('"0.1.0"', '"1.0.0"'));
  });

  it("changes tauri.conf.json", () => {
    expect(bump("tauri.conf.json", '{\n  "version": "0.1.0",\n}', release)).toBe(
      '{\n  "version": "1.0.0",\n}',
    );
  });

  it("changes the package version of Cargo.toml and pyproject.toml, not a dependency's", () => {
    const text = '[package]\nname = "z"\nversion = "0.1.0"\n\n[dependencies]\nserde = { version = "1" }\n';
    expect(bump("a/Cargo.toml", text, release)).toContain(
      'version = "1.0.0"\n\n[dependencies]\nserde = { version = "1" }',
    );
    expect(bump("pyproject.toml", text, release)).toContain('version = "1.0.0"');
  });

  it("changes only our own entry in the lock files", () => {
    const cargo =
      '[[package]]\nname = "vswhom"\nversion = "0.1.0"\n\n[[package]]\nname = "zimanyar-desktop"\nversion = "0.1.0"\n';
    expect(bump("x/Cargo.lock", cargo, release)).toBe(cargo.replace(/0\.1\.0"\n$/, '1.0.0"\n'));
    const uv = '[[package]]\nname = "zimanyar-data"\nversion = "0.1.0"\n';
    expect(bump("uv.lock", uv, release)).toBe(uv.replace("0.1.0", "1.0.0"));
  });

  it("changes the fallback version in the desktop vite config", () => {
    const text = 'JSON.stringify(process.env["npm_package_version"] ?? "0.1.0")';
    expect(bump("apps/desktop/vite.config.ts", text, release)).toBe(text.replace("0.1.0", "1.0.0"));
  });

  it("adds a Debian changelog entry on top, once", () => {
    const text =
      "zimanyar-cli (0.1.0) unstable; urgency=medium\n\n  * First.\n\n -- A <a@b>  Tue, 03 Nov 2026 12:00:00 +0000\n";
    const once = bump("debian/changelog", text, release);
    expect(once).toBe(
      "zimanyar-cli (1.0.0) unstable; urgency=medium\n\n  * The first stable version.\n\n" +
        ` -- Dolan H. <0xdolan@gmail.com>  Sat, 07 Nov 2026 12:00:00 +0000\n\n${text}`,
    );
    expect(bump("debian/changelog", once, release)).toBe(once);
  });

  it("adds an AppStream release on top, once, with the note escaped", () => {
    const text =
      '  <releases>\n    <release version="0.1.0" date="2026-11-01">\n    </release>\n  </releases>\n';
    const once = bump("x.metainfo.xml", text, { ...release, note: "Fixes <b> & more." });
    expect(once).toContain(
      '<releases>\n    <release version="1.0.0" date="2026-11-07">\n      <description>\n        <p>Fixes &lt;b> &amp; more.</p>',
    );
    expect(once.indexOf('"1.0.0"')).toBeLessThan(once.indexOf('"0.1.0"'));
    expect(bump("x.metainfo.xml", once, release)).toBe(once);
  });

  it.each([
    ["apps/cli/package.json", '{ "name": "x" }'],
    ["debian/changelog", "nothing here"],
    ["x.metainfo.xml", "<component/>"],
    ["x/Cargo.lock", 'name = "other"\nversion = "0.1.0"\n'],
    ["README.md", "version 0.1.0"],
  ])("refuses %s when it has no version where one belongs", (file, text) => {
    expect(() => bump(file, text, release)).toThrow(file);
  });

  it("formats Debian dates", () => {
    expect(debianDate(release.date)).toBe("Sat, 07 Nov 2026 12:00:00 +0000");
  });
});

describe("bump-version main", () => {
  afterEach(() => vi.restoreAllMocks());
  const files: Record<string, string> = {
    "package.json": '{\n  "version": "0.1.0"\n}\n',
    "apps/desktop/src-tauri/Cargo.toml": 'version = "0.1.0"\n',
    "apps/desktop/src-tauri/Cargo.lock": 'name = "zimanyar-desktop"\nversion = "0.1.0"\n',
    "apps/desktop/src-tauri/tauri.conf.json": '{\n  "version": "0.1.0"\n}\n',
    "apps/desktop/vite.config.ts": '["npm_package_version"] ?? "0.1.0"',
    "debian/changelog": "zimanyar-cli (0.1.0) unstable; urgency=medium\n",
    "packaging/linux/changelog": "zimanyar (0.1.0) unstable; urgency=medium\n",
    "packaging/linux/io.github._0xdolan.Zimanyar.metainfo.xml": "<releases>\n</releases>\n",
    "pyproject.toml": 'version = "0.1.0"\n',
    "uv.lock": 'name = "zimanyar-data"\nversion = "0.1.0"\n',
  };
  const run = (args: string[], tree = files) => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const written: Record<string, string> = {};
    const code = main(
      args,
      () => ["package.json"],
      (file) => tree[file] ?? "",
      (file, text) => {
        written[file] = text;
      },
      release.date,
    );
    return { code, written, error };
  };

  it("covers every fixed file", () => {
    expect(Object.keys(files).filter((f) => f !== "package.json")).toEqual(FIXED_FILES);
  });

  it("writes every file", () => {
    const { code, written } = run(["1.0.0"]);
    expect(code).toBe(0);
    expect(Object.keys(written).sort()).toEqual(Object.keys(files).sort());
    expect(written["debian/changelog"]).toContain("  * Version 1.0.0.");
  });

  it.each([[[]], [["v1.0.0"]], [["1.0"]]])("rejects %j", (args) => {
    expect(run(args).code).toBe(2);
  });

  it("writes nothing when one file is broken", () => {
    const { code, written, error } = run(["1.0.0"], { ...files, "pyproject.toml": "" });
    expect(code).toBe(1);
    expect(written).toEqual({});
    expect(error).toHaveBeenCalledWith("pyproject.toml: no version found");
  });
});
