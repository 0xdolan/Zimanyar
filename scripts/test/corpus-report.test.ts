import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { byFamily, failures, precision, readCorpus, recall, score } from "../corpus/report.js";

describe("the corpus report", () => {
  const lines = [
    { text: "a", findings: [{ rule: "r", span: "a" }] },
    { text: "b", findings: [{ rule: "r", span: "b" }] },
    { text: "c", findings: [] },
  ];

  it("counts true findings, false alarms and misses", () => {
    const found: Record<string, { rule: string; span: string }[]> = {
      a: [{ rule: "r", span: "a" }],
      b: [],
      c: [{ rule: "r", span: "c" }],
    };
    const { byRule, misses } = score(lines, (text) => found[text] ?? []);
    expect(byRule.get("r")).toEqual({ truePositives: 1, falsePositives: 1, falseNegatives: 1 });
    expect(misses).toEqual(['missed r on "b": b', 'false alarm r on "c": c']);
  });

  it("treats the right rule on the wrong text as both a false alarm and a miss", () => {
    const { byRule } = score([lines[0] as (typeof lines)[number]], () => [{ rule: "r", span: "x" }]);
    expect(byRule.get("r")).toEqual({ truePositives: 0, falsePositives: 1, falseNegatives: 1 });
  });

  it("computes precision and recall, and is not fooled by nothing found", () => {
    const tally = { truePositives: 3, falsePositives: 1, falseNegatives: 2 };
    expect(precision(tally)).toBe(0.75);
    expect(recall(tally)).toBe(0.6);
    expect(precision({ truePositives: 0, falsePositives: 0, falseNegatives: 5 })).toBe(1);
    expect(recall({ truePositives: 0, falsePositives: 5, falseNegatives: 0 })).toBe(1);
  });

  it("adds rules up into families", () => {
    const families = byFamily(
      new Map([
        ["a", { truePositives: 1, falsePositives: 2, falseNegatives: 3 }],
        ["b", { truePositives: 1, falsePositives: 1, falseNegatives: 1 }],
      ]),
      () => "spelling",
    );
    expect(families.get("spelling")).toEqual({ truePositives: 2, falsePositives: 3, falseNegatives: 4 });
  });

  it("fails a family below its target, and only families with targets", () => {
    const families = new Map([
      ["orthography", { truePositives: 90, falsePositives: 10, falseNegatives: 0 }],
      ["agreement", { truePositives: 5, falsePositives: 0, falseNegatives: 5 }],
      ["style", { truePositives: 0, falsePositives: 9, falseNegatives: 9 }],
      ["morphology", { truePositives: 9, falsePositives: 1, falseNegatives: 9 }],
    ] as const);
    expect(failures(families)).toEqual([
      "orthography: precision 0.90 < 0.98",
      "agreement: recall 0.50 < 0.6",
    ]);
  });

  it("reads a folder of sentences, and survives a missing one", () => {
    const directory = mkdtempSync(join(tmpdir(), "zimanyar-corpus-"));
    writeFileSync(join(directory, "b.jsonl"), '{"text":"b","findings":[]}\n\n');
    writeFileSync(join(directory, "a.jsonl"), '{"text":"a","findings":[]}\n');
    writeFileSync(join(directory, "note.txt"), "not this");
    expect(readCorpus(directory).map((line) => line.text)).toEqual(["a", "b"]);
    expect(readCorpus(join(directory, "none"))).toEqual([]);
  });
});
