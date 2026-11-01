import type { Finding } from "@zimanyar/rules";
import { describe, expect, it } from "vitest";
import {
  checkOptionsFrom,
  defaultSettings,
  filterFindings,
  isSiteEnabled,
  parseDictionary,
  parseSettings,
  ruleFamilies,
  type Settings,
  withWord,
} from "../src/index.js";

const finding = (overrides: Partial<Finding> = {}): Finding =>
  ({
    lang: "kmr",
    severity: "error",
    category: "spelling",
    range: { start: 0, end: 3 },
    ...overrides,
  }) as Finding;

const edit = (change: (settings: Settings) => void): Settings => {
  const settings = defaultSettings();
  change(settings);
  return settings;
};

describe("parseSettings", () => {
  it("fills in everything from nothing", () => {
    expect(parseSettings({})).toEqual(defaultSettings());
    expect(defaultSettings().languages.enabled).toEqual(["ckb", "kmr"]);
    expect(defaultSettings().teaching.mode).toBe(true);
  });

  it("keeps what is valid and fills in the rest", () => {
    const parsed = parseSettings({ interface: { uiLang: "ckb" } });
    expect(parsed.interface.uiLang).toBe("ckb");
    expect(parsed.interface.theme).toBe("system");
  });

  it.each([
    [null],
    [undefined],
    ["text"],
    [7],
    [{ interface: { uiLang: "fr" } }],
    [{ dictionary: { words: [1] } }],
  ])("falls back to the defaults for %j", (stored) => {
    expect(parseSettings(stored)).toEqual(defaultSettings());
  });

  it("brings an older version up to date", () => {
    expect(parseSettings({ version: 0, checking: { minSeverity: "error" } }).checking.minSeverity).toBe(
      "error",
    );
    expect(parseSettings({ version: 0 }).version).toBe(1);
  });

  it("refuses an absurdly long word", () => {
    expect(parseSettings({ dictionary: { words: ["a".repeat(101)] } }).dictionary.words).toEqual([]);
  });
});

describe("checkOptionsFrom", () => {
  it("detects the language by default", () => {
    expect(checkOptionsFrom(defaultSettings())).toEqual({
      lang: "auto",
      strictness: "standard",
      disabledRules: [],
    });
  });

  it("uses the chosen language when detection is off", () => {
    const options = checkOptionsFrom(
      edit((settings) => {
        settings.languages.autoDetect = false;
        settings.languages.fallback = "kmr";
      }),
    );
    expect(options.lang).toBe("kmr");
  });

  it("turns a family off through its rules, and adds rules ignored one by one", () => {
    const options = checkOptionsFrom(
      edit((settings) => {
        settings.checking.disabledFamilies = ["ergative"];
        settings.dictionary.ignoredRules = ["any.repeat.word"];
      }),
    );
    expect(options.disabledRules).toContain("kmr.ergative.agreement");
    expect(options.disabledRules).toContain("any.repeat.word");
    expect(options.disabledRules).not.toContain("kmr.spell.unknown");
  });

  it("knows the families", () => {
    expect(ruleFamilies()).toContain("ergative");
  });
});

describe("filterFindings", () => {
  it("keeps everything by default", () => {
    expect(filterFindings([finding()], "mak dît", defaultSettings())).toHaveLength(1);
  });

  it("drops what is below the chosen severity", () => {
    const settings = edit((changed) => {
      changed.checking.minSeverity = "warning";
    });
    expect(filterFindings([finding({ severity: "hint" })], "mak", settings)).toEqual([]);
    expect(filterFindings([finding({ severity: "warning" })], "mak", settings)).toHaveLength(1);
  });

  it("drops a variety that is turned off, but not rules for both", () => {
    const settings = edit((changed) => {
      changed.languages.enabled = ["ckb"];
    });
    expect(filterFindings([finding({ lang: "kmr" })], "mak", settings)).toEqual([]);
    expect(filterFindings([finding({ lang: "any" })], "mak", settings)).toHaveLength(1);
  });

  it("does not flag a personal word as a spelling mistake, but keeps other mistakes in it", () => {
    const settings = withWord(defaultSettings(), "mak");
    expect(filterFindings([finding()], "mak dît", settings)).toEqual([]);
    expect(filterFindings([finding({ category: "agreement" })], "mak dît", settings)).toHaveLength(1);
  });

  it("drops words ignored on this site only", () => {
    const settings = edit((changed) => {
      changed.dictionary.ignoredWordsBySite["https://a.example"] = ["mak"];
    });
    expect(filterFindings([finding()], "mak", settings, "https://a.example")).toEqual([]);
    expect(filterFindings([finding()], "mak", settings, "https://b.example")).toHaveLength(1);
    expect(filterFindings([finding()], "mak", settings)).toHaveLength(1);
  });
});

describe("the personal dictionary", () => {
  it("stays sorted and free of repeats", () => {
    const settings = withWord(withWord(withWord(defaultSettings(), "z"), "a"), "z");
    expect(settings.dictionary.words).toEqual(["a", "z"]);
  });

  it("imports a list of words", () => {
    expect(parseDictionary('["a","b"]')).toEqual(["a", "b"]);
  });

  it.each([["not json"], ['{"a":1}'], ["[1]"], ['[""]']])("refuses %s", (json) => {
    expect(parseDictionary(json)).toBeNull();
  });
});

describe("sites", () => {
  it("are off until enabled", () => {
    expect(isSiteEnabled(defaultSettings(), "https://a.example")).toBe(false);
  });

  it("are on one by one, or everywhere", () => {
    const one = edit((settings) => {
      settings.sites.enabled = ["https://a.example"];
    });
    expect(isSiteEnabled(one, "https://a.example")).toBe(true);
    expect(isSiteEnabled(one, "https://b.example")).toBe(false);
    const all = edit((settings) => {
      settings.sites.everywhere = true;
    });
    expect(isSiteEnabled(all, "https://b.example")).toBe(true);
  });
});
