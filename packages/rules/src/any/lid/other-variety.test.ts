import { describe, expect, it } from "vitest";
import { buildParagraph, createContext, runRules } from "../../index.js";
import { otherVariety } from "./other-variety.js";

const run = (text: string) =>
  runRules(
    buildParagraph(text),
    [otherVariety],
    createContext("kmr", { lexicon: null, strictness: "standard" }),
  );

describe("any.lid.other-variety", () => {
  it.each([
    ["The children went to school this morning and the weather was very nice", "eng"],
    ["Bugün hava çok güzel ve çocuklar okuldan sonra parkta oynamak istiyorlar", "tur"],
    ["این کتاب را من دیروز خریدم و خیلی خوب است که می‌خواهم آن را بخوانم", "fas"],
  ])("notices %s", (text, language) => {
    expect(run(text)[0]?.message.params).toEqual({ language });
    expect(run(text)[0]?.range).toEqual({ start: 0, end: text.length });
    expect(run(text)[0]?.suggestions).toEqual([]);
  });

  it.each([
    "Ez di malê de me û ji bo wê dibêje ku ew li gund e",
    "من لە ماڵ بووم و ئەو لەگەڵ ئێمە هات بۆ ئێرە",
    "kitêb",
    "",
  ])("leaves Kurdish and short text alone: %s", (text) => {
    expect(run(text)).toEqual([]);
  });
});
