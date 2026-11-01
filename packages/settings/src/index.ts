import { allRuleMeta, type Finding, type Severity, type Strictness, type Variety } from "@zimanyar/rules";
import { z } from "zod";

const CURRENT_VERSION = 1;

const variety = z.enum(["ckb", "kmr"]);
/** No word in a personal dictionary is longer than this, and nothing else belongs in one. */
const word = z.string().min(1).max(100);
const ruleId = z.string().min(1).max(100);
/** An origin such as https://example.org, as sites are enabled one by one. */
const site = z.string().min(1).max(300);

/** Every field has a default, so that settings from an older version, or none at all, still load. */
export const settingsSchema = z.object({
  version: z.literal(CURRENT_VERSION).default(CURRENT_VERSION),
  languages: z
    .object({
      enabled: z.array(variety).default(["ckb", "kmr"]),
      autoDetect: z.boolean().default(true),
      fallback: variety.default("ckb"),
    })
    .prefault({}),
  checking: z
    .object({
      disabledFamilies: z.array(z.string().max(50)).default([]),
      strictness: z.enum(["standard", "tolerant"]).default("standard"),
      minSeverity: z.enum(["error", "warning", "hint"]).default("hint"),
    })
    .prefault({}),
  teaching: z
    .object({
      mode: z.boolean().default(true),
      lessonLinks: z.boolean().default(true),
    })
    .prefault({}),
  autocomplete: z
    .object({
      enabled: z.boolean().default(true),
      count: z.number().int().min(1).max(10).default(6),
      typingHelper: z.boolean().default(true),
    })
    .prefault({}),
  dictionary: z
    .object({
      words: z.array(word).default([]),
      ignoredRules: z.array(ruleId).default([]),
      ignoredWordsBySite: z.record(site, z.array(word)).default({}),
    })
    .prefault({}),
  sites: z
    .object({
      enabled: z.array(site).default([]),
      everywhere: z.boolean().default(false),
    })
    .prefault({}),
  interface: z
    .object({
      uiLang: z.enum(["en", "ckb", "kmr"]).default("en"),
      theme: z.enum(["system", "light", "dark"]).default("system"),
      underline: z.enum(["thin", "thick"]).default("thin"),
      fontSize: z.enum(["small", "normal", "large"]).default("normal"),
    })
    .prefault({}),
});

export type Settings = z.infer<typeof settingsSchema>;

/** The settings as they are after an update from any older version. There are no older versions yet. */
const migrate = (stored: Record<string, unknown>): Record<string, unknown> => ({
  ...stored,
  version: CURRENT_VERSION,
});

export const defaultSettings = (): Settings => settingsSchema.parse({});

/**
 * Settings from storage or an imported file, which cannot be trusted. Whatever is wrong with them, the
 * answer is usable settings: a damaged file should not stop the checker.
 */
export function parseSettings(stored: unknown): Settings {
  if (typeof stored !== "object" || stored === null) return defaultSettings();
  const parsed = settingsSchema.safeParse(migrate(stored as Record<string, unknown>));
  return parsed.success ? parsed.data : defaultSettings();
}

/** Every rule family there is, with the varieties it covers, for the settings page. */
export const ruleFamilies = (): string[] => [...new Set(allRuleMeta().map((rule) => rule.family))].sort();

export interface CheckOptionsFromSettings {
  lang: Variety | "auto";
  strictness: Strictness;
  disabledRules: string[];
}

/** What the checker should be told. `lang` is the language to use when detection is off. */
export function checkOptionsFrom(settings: Settings): CheckOptionsFromSettings {
  const families = new Set(settings.checking.disabledFamilies);
  return {
    lang: settings.languages.autoDetect ? "auto" : settings.languages.fallback,
    strictness: settings.checking.strictness,
    disabledRules: [
      ...settings.dictionary.ignoredRules,
      ...allRuleMeta()
        .filter((rule) => families.has(rule.family))
        .map((rule) => rule.id),
    ],
  };
}

const SEVERITY_RANK: Record<Severity, number> = { hint: 0, warning: 1, error: 2 };

/** The findings left after the writer's own choices: disabled varieties, severity and personal words. */
export function filterFindings(
  findings: readonly Finding[],
  text: string,
  settings: Settings,
  origin?: string,
): Finding[] {
  const known = new Set(settings.dictionary.words);
  const here = new Set(origin === undefined ? [] : (settings.dictionary.ignoredWordsBySite[origin] ?? []));
  const least = SEVERITY_RANK[settings.checking.minSeverity];
  return findings.filter((finding) => {
    if (SEVERITY_RANK[finding.severity] < least) return false;
    if (finding.lang !== "any" && !settings.languages.enabled.includes(finding.lang)) return false;
    const covered = text.slice(finding.range.start, finding.range.end);
    return !(finding.category === "spelling" && known.has(covered)) && !here.has(covered);
  });
}

/** A copy with a word added, keeping the list sorted and free of repeats. */
export const withWord = (settings: Settings, added: string): Settings => ({
  ...settings,
  dictionary: {
    ...settings.dictionary,
    words: [...new Set([...settings.dictionary.words, added])].sort(),
  },
});

/** The words of an imported dictionary: a JSON list of strings, or null if it is anything else. */
export function parseDictionary(json: string): string[] | null {
  try {
    const parsed = z.array(word).safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Whether Zimanyar should run by itself on a page from this origin. */
export const isSiteEnabled = (settings: Settings, origin: string): boolean =>
  settings.sites.everywhere || settings.sites.enabled.includes(origin);
