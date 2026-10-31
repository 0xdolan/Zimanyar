import { describe, expect, it } from "vitest";
import { findProblems, usedKeys } from "../checks/check-i18n.js";

describe("check-i18n", () => {
  it("finds keys in code", () => {
    expect(usedKeys(`t("a.b"); t('c.d', { x: 1 }); t( "e.f" ); notT("no"); important("no")`)).toEqual([
      "a.b",
      "c.d",
      "e.f",
    ]);
  });

  it("accepts complete catalogues", () => {
    const catalogues = { en: { "a.b": "x" }, ckb: { "a.b": "y" }, kmr: { "a.b": "z" } };
    expect(findProblems(catalogues, new Set(["a.b"]))).toEqual([]);
  });

  it("reports a missing and an extra translation", () => {
    const catalogues = { en: { "a.b": "x" }, ckb: { "c.d": "y" }, kmr: { "a.b": "z" } };
    expect(findProblems(catalogues, new Set(["a.b"]))).toEqual([
      "ckb: missing a.b",
      "ckb: c.d is not in the English catalogue",
    ]);
  });

  it("reports a key code uses that does not exist, and one nothing uses", () => {
    const catalogues = { en: { "a.b": "x" } };
    expect(findProblems(catalogues, new Set(["no.such"]))).toEqual([
      "code uses no.such, which no catalogue has",
      "no code uses a.b",
    ]);
  });

  it("does not ask code to name keys it builds from data", () => {
    expect(
      findProblems(
        { en: { "category.spelling": "x", "severity.error": "y", "lang.en": "z", "theme.dark": "w" } },
        new Set(),
      ),
    ).toEqual([]);
  });
});
