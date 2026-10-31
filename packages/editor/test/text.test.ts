import type { Finding } from "@zimanyar/rules";
import { describe, expect, it } from "vitest";
import { changedRange, shiftFindings, varietyOf, wordBefore } from "../src/text.js";

const finding = (start: number, end: number) => ({ id: `${start}`, range: { start, end } }) as Finding;
const ranges = (found: readonly Finding[]) => found.map(({ range }) => [range.start, range.end]);

describe("changedRange", () => {
  it("finds an insertion, a deletion and a replacement", () => {
    expect(changedRange("abcd", "abXcd")).toEqual({ start: 2, beforeEnd: 2, afterEnd: 3 });
    expect(changedRange("abXcd", "abcd")).toEqual({ start: 2, beforeEnd: 3, afterEnd: 2 });
    expect(changedRange("abcd", "aXd")).toEqual({ start: 1, beforeEnd: 3, afterEnd: 2 });
  });

  it("does not count one character twice in a repeated run", () => {
    expect(changedRange("aaa", "aaaa")).toEqual({ start: 3, beforeEnd: 3, afterEnd: 4 });
    expect(changedRange("aa", "aa")).toEqual({ start: 2, beforeEnd: 2, afterEnd: 2 });
  });
});

describe("shiftFindings", () => {
  const text = "one two three";

  it("leaves findings before the edit alone and moves those after it", () => {
    expect(ranges(shiftFindings([finding(0, 3), finding(8, 13)], text, "one XX two three"))).toEqual([
      [0, 3],
      [11, 16],
    ]);
  });

  it("moves findings back after a deletion", () => {
    expect(ranges(shiftFindings([finding(3, 5)], "aa bb cc", "bb cc"))).toEqual([[0, 2]]);
  });

  it("drops a finding the edit touched", () => {
    expect(shiftFindings([finding(4, 7)], text, "one twX three")).toEqual([]);
  });

  it("keeps everything when nothing changed", () => {
    expect(ranges(shiftFindings([finding(4, 7)], text, text))).toEqual([[4, 7]]);
  });
});

describe("wordBefore", () => {
  it("finds the part of a word before the caret", () => {
    expect(wordBefore("ez kit", 6)).toEqual({ start: 3, word: "kit" });
    expect(wordBefore("ez kitêb", 6)).toEqual({ start: 3, word: "kit" });
  });

  it("keeps Kurdish letters and marks together", () => {
    expect(wordBefore("من کتێب", 7)).toEqual({ start: 3, word: "کتێب" });
  });

  it("finds nothing after a space or at the start", () => {
    expect(wordBefore("ez ", 3)).toBeNull();
    expect(wordBefore("ez", 0)).toBeNull();
  });
});

describe("varietyOf", () => {
  it("goes by the script", () => {
    expect(varietyOf("کتێب")).toBe("ckb");
    expect(varietyOf("kitêb")).toBe("kmr");
  });
});
