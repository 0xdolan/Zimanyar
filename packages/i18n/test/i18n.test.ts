import { describe, expect, it } from "vitest";
import {
  catalogueOf,
  createT,
  dirOf,
  formatNumber,
  formatPercent,
  type MessageKey,
  render,
  UI_LANGS,
} from "../src/index.js";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)[,}]/g)].map((match) => match[1]).sort();

describe("the catalogues", () => {
  const keys = Object.keys(catalogueOf("en"));

  it.each(UI_LANGS)("%s has exactly the English keys", (lang) => {
    expect(Object.keys(catalogueOf(lang)).sort()).toEqual([...keys].sort());
  });

  it.each(UI_LANGS)("%s has no empty string", (lang) => {
    for (const value of Object.values(catalogueOf(lang))) expect(value.trim()).not.toBe("");
  });

  it.each(["ckb", "kmr"] as const)("%s uses the same placeholders as English", (lang) => {
    for (const key of keys) {
      expect(placeholders(catalogueOf(lang)[key] as string), key).toEqual(
        placeholders(catalogueOf("en")[key] as string),
      );
    }
  });
});

describe("createT", () => {
  it("translates and fills in values", () => {
    expect(createT("en")("finding.applyAria", { suggestion: "dîtî" })).toBe("Replace with dîtî");
    expect(createT("kmr")("finding.ignore")).toBe("Paşguh bike");
    expect(createT("ckb")("finding.ignore")).toBe("پشتگوێی بخە");
  });

  it("falls back to the key for one it does not know", () => {
    expect(createT("en")("no.such.key" as MessageKey)).toBe("no.such.key");
  });

  it("chooses plurals by number, in the language's digits", () => {
    expect(createT("en")("findings.count", { count: 1 })).toBe("1 finding");
    expect(createT("en")("findings.count", { count: 3 })).toBe("3 findings");
    expect(createT("kmr")("findings.count", { count: 3 })).toBe("3 dîtin");
    expect(createT("ckb")("findings.count", { count: 3 })).toBe("٣ دۆزینەوە");
    expect(createT("ckb", { easternDigits: false })("findings.count", { count: 3 })).toBe("3 دۆزینەوە");
  });
});

describe("render", () => {
  it("inserts values as plain text, once, without reading them as templates", () => {
    expect(render("{a}", "en", { a: "<b>{b}</b>" })).toBe("<b>{b}</b>");
  });

  it("leaves unknown placeholders and a plural without a number visible", () => {
    expect(render("hello {name}", "en")).toBe("hello {name}");
    const plural = "{count, plural, one {# x} other {# y}}";
    expect(render(plural, "en")).toBe(plural);
    expect(render(plural, "en", { count: "many" })).toBe(plural);
  });

  it("uses other when a language has no branch for its category", () => {
    expect(render("{count, plural, other {# y}}", "en", { count: 1 })).toBe("1 y");
    expect(render("{count, plural, one {# y}}", "en", { count: 2 })).toBe("");
  });
});

describe("numbers", () => {
  it("writes Eastern digits in Sorani unless told not to", () => {
    expect(formatNumber(2015, "ckb")).toBe("٢٠١٥");
    expect(formatNumber(2015, "ckb", { easternDigits: false })).toBe("2015");
    expect(formatNumber(2015, "kmr")).toBe("2015");
    expect(formatNumber(2015, "en")).toBe("2015");
  });

  it("writes percentages", () => {
    expect(formatPercent(0.9, "en")).toBe("90%");
    expect(formatPercent(0.855, "ckb")).toBe("٨٦%");
  });
});

describe("direction", () => {
  it("is right to left only for Sorani", () => {
    expect(dirOf("ckb")).toBe("rtl");
    expect(dirOf("kmr")).toBe("ltr");
    expect(dirOf("en")).toBe("ltr");
  });
});
