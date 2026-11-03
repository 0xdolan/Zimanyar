import { describe, expect, it } from "vitest";
import { disabledBy, unknownRules } from "../src/check.js";
import { wordsOf } from "../src/cli.js";
import { cli } from "./helpers.js";

const README = `# Zimanyar

Min tu dîtim. Ez diçim malê.

Ji bo sazkirinê \`npm install -g zimanyar\` binivîse û [malpera me](https://example.org/dîtim) bibîne.

\`\`\`sh
zimanyar check README.ku.md
\`\`\`
`;

interface Report {
  version: number;
  files: {
    path: string;
    findings: {
      ruleId: string;
      severity: string;
      line: number;
      column: number;
      text: string;
      suggestions: string[];
      lessons: { lang: string; url: string }[];
    }[];
  }[];
  summary: { errors: number; warnings: number; hints: number; files: number };
}

describe("user story 6", () => {
  it("zimanyar check --lang kmr --format json README.ku.md exits with 1 and prints machine-readable findings", async () => {
    const ran = await cli(["check", "--lang", "kmr", "--format", "json", "README.ku.md"], {
      files: { "README.ku.md": README },
    });
    expect(ran.code).toBe(1);
    const report = JSON.parse(ran.out) as Report;
    expect(report.version).toBe(1);
    const agreement = report.files[0]?.findings.find(
      (finding) => finding.ruleId === "kmr.ergative.agreement",
    );
    expect(agreement).toMatchObject({
      severity: "error",
      line: 3,
      column: 8,
      text: "dîtim",
      suggestions: ["dîtî"],
    });
    expect(agreement?.lessons[0]?.url).toContain("/learn/kurmanji/14-");
    expect(report.summary.errors).toBe(1);
  });

  it("exits with 0 when nothing is at or above the failing severity", async () => {
    expect((await cli(["check", "-"], { stdin: "Ez diçim malê." })).code).toBe(0);
    const warnings = await cli(["check", "--fail-on", "never", "-"], { stdin: "Min tu dîtim." });
    expect(warnings.code).toBe(0);
  });

  it("fails on warnings or hints when asked", async () => {
    const text = "Ez diçim  malê.";
    expect((await cli(["check", "-"], { stdin: text })).code).toBe(0);
    expect((await cli(["check", "--fail-on", "warning", "-"], { stdin: text })).code).toBe(1);
  });
});

describe("Markdown", () => {
  it("checks only the prose: code, link targets and markup make no findings", async () => {
    const ran = await cli(
      ["check", "--lang", "kmr", "--format", "json", "--dictionary", "words.txt", "README.ku.md"],
      {
        files: { "README.ku.md": README, "words.txt": "# names\nZimanyar\n" },
      },
    );
    const findings = (JSON.parse(ran.out) as Report).files[0]?.findings ?? [];
    expect(findings.map((finding) => finding.ruleId)).toEqual(["kmr.ergative.agreement"]);
  });

  it("keeps a mistake inside emphasis, and reports it at the file's own column", async () => {
    const ran = await cli(["check", "--format", "json", "a.md"], { files: { "a.md": "Min tu **dîtim**." } });
    const finding = (JSON.parse(ran.out) as Report).files[0]?.findings[0];
    expect(finding).toMatchObject({ ruleId: "kmr.ergative.agreement", column: 10, text: "dîtim" });
  });

  it("treats standard input as Markdown with --markdown", async () => {
    const stdin = "`Min tu dîtim.`\n";
    expect((await cli(["check", "-"], { stdin })).code).toBe(1);
    expect((await cli(["check", "--markdown", "-"], { stdin })).code).toBe(0);
  });
});

describe("--fix", () => {
  it("applies safe fixes to a file and writes it back", async () => {
    const ran = await cli(["check", "--fix", "a.txt"], { files: { "a.txt": "كوردستان جوانە." } });
    expect(ran.files.get("a.txt")).toBe("کوردستان جوانە.");
    expect(ran.out).toContain("1 file");
  });

  it("writes the corrected text of standard input to standard output, and what is left to the error stream", async () => {
    const ran = await cli(["check", "--fix", "-"], { stdin: "كوردستان جوانە.\n\nMin tu dîtim." });
    expect(ran.out).toBe("کوردستان جوانە.\n\nMin tu dîtim.");
    expect(ran.err).toContain("kmr.ergative.agreement");
    expect(ran.code).toBe(1);
  });

  it("fixes the prose of Markdown and leaves its code alone", async () => {
    const ran = await cli(["check", "--fix", "a.md"], {
      files: { "a.md": "كوردستان\n\n```\nكوردستان\n```\n" },
    });
    expect(ran.files.get("a.md")).toBe("کوردستان\n\n```\nكوردستان\n```\n");
  });
});

describe("rules", () => {
  it("runs only the rules a list names, by id or prefix", async () => {
    const text = "Min tu dîtim. Ez diçim  malê.";
    const all = await cli(["check", "--format", "json", "-"], { stdin: text });
    const only = await cli(["check", "--format", "json", "--rules", "kmr.ergative", "-"], { stdin: text });
    const off = await cli(["check", "--format", "json", "--disable", "kmr.ergative.agreement", "-"], {
      stdin: text,
    });
    const ids = (ran: { out: string }) =>
      (JSON.parse(ran.out) as Report).files[0]?.findings.map((finding) => finding.ruleId) ?? [];
    expect(ids(all)).toContain("kmr.ergative.agreement");
    expect(ids(all).length).toBeGreaterThan(1);
    expect(ids(only)).toEqual(["kmr.ergative.agreement"]);
    expect(ids(off)).not.toContain("kmr.ergative.agreement");
  });

  it("knows which entries match no rule", () => {
    expect(unknownRules(["kmr.ergative", "ckb", "nope.rule"])).toEqual(["nope.rule"]);
    expect(disabledBy([], [])).toEqual([]);
    expect(disabledBy(["kmr"], []).every((id) => !id.startsWith("kmr."))).toBe(true);
  });

  it("rejects a rule that does not exist with exit code 2", async () => {
    const ran = await cli(["check", "--rules", "kmr.nope", "-"]);
    expect(ran.code).toBe(2);
    expect(ran.err).toContain("kmr.nope");
  });
});

describe("dictionaries", () => {
  it("reads the apps' exported JSON list and plain word lists", () => {
    expect(wordsOf('["Zimanyar","Hawar"]')).toEqual(["Zimanyar", "Hawar"]);
    expect(wordsOf("Zimanyar\n# a comment\n\n  Hawar  # the journal\n")).toEqual(["Zimanyar", "Hawar"]);
  });

  it("reports a dictionary it cannot read as a usage error", async () => {
    expect((await cli(["check", "--dictionary", "missing.txt", "-"])).code).toBe(2);
  });
});

describe("text report", () => {
  it("shows file, line, column, severity, message, fix and lesson", async () => {
    const ran = await cli(["check", "a.txt"], { files: { "a.txt": "Ez diçim malê.\nMin tu dîtim." } });
    expect(ran.out).toContain(
      "a.txt:2:8  Error  In the past this verb agrees with the object, tu.  kmr.ergative.agreement",
    );
    expect(ran.out).toContain("Fix: dîtim → dîtî");
    expect(ran.out).toContain("1 error, 0 warnings and 0 hints in 1 file.");
    expect(ran.out).not.toContain("\u001b[");
  });

  it("colours a terminal, and NO_COLOR turns it off", async () => {
    const options = { stdin: "Min tu dîtim.", tty: true };
    expect((await cli(["check", "-"], options)).out).toContain("\u001b[31m");
    expect((await cli(["check", "-"], { ...options, env: { NO_COLOR: "1" } })).out).not.toContain("\u001b[");
  });

  it("points a rule for both varieties to the lesson in the variety of the line", async () => {
    const ran = await cli(["check", "--format", "json", "-"], { stdin: "Ez diçim  malê." });
    const finding = (JSON.parse(ran.out) as Report).files[0]?.findings[0];
    expect(finding?.lessons[0]?.lang).toBe("kmr");
  });

  it("never passes a file's control characters to the terminal", async () => {
    const path = "evil\u001b]0;owned\u0007.txt";
    const ran = await cli(["check", path], { files: { [path]: "Min tu dîtim.\u001b[2J" }, tty: true });
    const escapes = ran.out.match(new RegExp(`${String.fromCharCode(27)}[^[]`, "g")) ?? [];
    expect(escapes).toEqual([]);
    expect(ran.out).not.toContain("\u0007");
    expect(ran.out).toContain("evil\\u001b]0;owned\\u0007.txt");
  });

  it("says so when nothing is to be corrected", async () => {
    expect((await cli(["check", "-"], { stdin: "Ez diçim malê." })).out).toContain(
      "Nothing to correct in 1 file.",
    );
  });

  it("reports in Sorani and Kurmanji", async () => {
    const sorani = await cli(["check", "--ui", "ckb", "-"], { stdin: "Min tu dîtim." });
    expect(sorani.out).toContain("هەڵە");
    const kurmanji = await cli(["check", "--ui=kmr", "-"], { stdin: "Min tu dîtim." });
    expect(kurmanji.out).toContain("Şaşî");
    expect(kurmanji.out).toContain("1 şaşî, 0 hişyarî û 0 şîret di 1 pelê de.");
  });
});

describe("SARIF", () => {
  it("writes a 2.1.0 log with rules, results, regions in UTF-16 units and fixes", async () => {
    const ran = await cli(["check", "--format", "sarif", "docs/a.md"], {
      files: { "docs/a.md": "😀 Min tu dîtim." },
    });
    expect(ran.code).toBe(1);
    const log = JSON.parse(ran.out);
    expect(log.version).toBe("2.1.0");
    const run = log.runs[0];
    expect(run.columnKind).toBe("utf16CodeUnits");
    expect(run.tool.driver.rules[0]).toMatchObject({
      id: "kmr.ergative.agreement",
      helpUri: "https://0xdolan.github.io/Zimanyar/rules/kmr.ergative.agreement/",
      defaultConfiguration: { level: "error" },
    });
    const [result] = run.results;
    expect(result.ruleIndex).toBe(0);
    expect(result.locations[0].physicalLocation.artifactLocation.uri).toBe("docs/a.md");
    // The emoji takes two UTF-16 units.
    expect(result.locations[0].physicalLocation.region).toMatchObject({
      startLine: 1,
      startColumn: 11,
      charOffset: 10,
      charLength: 5,
    });
    expect(result.fixes[0].artifactChanges[0].replacements[0].insertedContent.text).toBe("dîtî");
    expect(result.partialFingerprints["zimanyar/v1"]).toMatch(/^[0-9a-f]{32}$/);
  });

  it("maps hints to notes", async () => {
    const ran = await cli(["check", "--format", "sarif", "-"], {
      stdin: "This paragraph is written in English and has nothing Kurdish in it at all.",
    });
    expect(JSON.parse(ran.out).runs[0].results[0]?.level).toBe("note");
  });
});

describe("usage errors", () => {
  it.each([
    [["check", "--format", "xml", "-"], "--format"],
    [["check", "--lang", "zza", "-"], "--lang"],
    [["check", "--nonsense"], "nonsense"],
    [["check", "missing.txt"], "missing.txt"],
    [["frobnicate"], "frobnicate"],
  ])("%j exits with 2", async (argv, mentioned) => {
    const ran = await cli(argv);
    expect(ran.code).toBe(2);
    expect(ran.err).toContain(mentioned);
  });
});
