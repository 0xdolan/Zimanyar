import { describe, expect, it } from "vitest";
import { ROOT, run, tempFile } from "./helpers.js";

const script = `${ROOT}/scripts/checks/check-dashes.sh`;
const check = (text: string) => run(script, [tempFile("sample.txt", text)]).status;

describe("check-dashes.sh", () => {
  it.each(["plain hyphen-minus", "a · b", "Sorani کوردی", "x: y, z"])("accepts %j", (text) => {
    expect(check(text)).toBe(0);
  });

  it.each([
    ["em dash", [0x2014]],
    ["en dash", [0x2013]],
    ["figure dash", [0x2012]],
    ["horizontal bar", [0x2015]],
    ["hyphen", [0x2010]],
    ["minus sign", [0x2212]],
    ["two-em dash", [0x2e3a]],
    ["small em dash", [0xfe58]],
    ["fullwidth hyphen-minus", [0xff0d]],
    ["box drawing", [0x2500, 0x2502]],
  ])("rejects %s", (_name, codePoints) => {
    expect(check(`before ${String.fromCodePoint(...codePoints)} after`)).toBe(1);
  });

  it("passes on the repository itself", () => {
    expect(run(script, []).status).toBe(0);
  });
});
