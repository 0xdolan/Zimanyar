import { ARABIC_SCRIPT_PROFILES, LATIN_SCRIPT_PROFILES, LID_REGEX_FEATURES } from "./generated/tables.js";
import { count, pythonRegex, round } from "./python.js";
import { detectScript, type Script } from "./text.js";
import { words } from "./tokenize.js";

export type LidLang = "ckb" | "kmr" | "hac" | "zza" | "fas" | "arb" | "tur" | "eng" | "und";

export interface LidResult {
  lang: LidLang;
  script: Script;
  confidence: number;
  scores: Partial<Record<LidLang, number>>;
}

interface RawProfile {
  words: readonly string[];
  strong?: number;
  chars: Readonly<Record<string, number>>;
  ngrams: Readonly<Record<string, number>>;
}

interface Profile {
  lang: LidLang;
  words: ReadonlySet<string>;
  strong: number;
  chars: readonly (readonly [string, number])[];
  ngrams: readonly (readonly [string, number])[];
  features: readonly (readonly [RegExp, number])[];
}

const features = LID_REGEX_FEATURES as unknown as Record<string, [string, number][]>;

const build = (profiles: Readonly<Record<string, RawProfile>>): Profile[] =>
  Object.entries(profiles).map(([lang, raw]) => ({
    lang: lang as LidLang,
    words: new Set(raw.words),
    strong: raw.strong ?? 1,
    chars: Object.entries(raw.chars),
    ngrams: Object.entries(raw.ngrams),
    features: (features[lang] ?? []).map(([source, weight]) => [pythonRegex(source, "g"), weight] as const),
  }));

const ARABIC = build(ARABIC_SCRIPT_PROFILES as Record<string, RawProfile>);
const LATIN = build(LATIN_SCRIPT_PROFILES as Record<string, RawProfile>);

function score(text: string, tokens: readonly string[], profiles: readonly Profile[]): [LidLang, number][] {
  const total = Math.max(tokens.length, 1);
  const padded = ` ${text} `;
  const lowered = tokens.map((token) => token.toLowerCase());
  return profiles.map((profile) => {
    let sum = 0;
    for (const token of lowered) if (profile.words.has(token)) sum++;
    sum *= profile.strong;
    for (const [part, weight] of profile.chars) sum += count(padded, part) * weight;
    for (const [part, weight] of profile.ngrams) sum += count(padded, part) * weight;
    for (const [pattern, weight] of profile.features) {
      sum += Array.from(text.matchAll(pattern)).length * weight;
    }
    return [profile.lang, sum / total];
  });
}

/** Identify the language of a paragraph, from function words, letters and word shapes. */
export function identify(text: string, margin = 0.15, minWords = 3): LidResult {
  const script = detectScript(text);
  if (script !== "arabic" && script !== "latin") return { lang: "und", script, confidence: 0, scores: {} };
  const tokens = words(text);
  if (tokens.length < minWords) {
    return { lang: script === "arabic" ? "ckb" : "kmr", script, confidence: 0.1, scores: {} };
  }
  const profiles = script === "arabic" ? ARABIC : LATIN;
  const entries = score(script === "latin" ? text.toLowerCase() : text, tokens, profiles);
  const scores = Object.fromEntries(entries);
  // A stable sort: languages with equal scores stay in profile order, as in zimankit.
  const ranked = [...entries].sort((a, b) => b[1] - a[1]);
  const [best, top] = ranked[0] as [LidLang, number];
  const second = (ranked[1] as [LidLang, number])[1];
  if (top <= 0 || top - second < margin * Math.max(top, 1e-9)) {
    return { lang: "und", script, confidence: 0, scores };
  }
  return { lang: best, script, confidence: round(Math.min(1, (top - second) / top), 3), scores };
}

export function isLang(text: string, lang: LidLang, minConfidence = 0.2): boolean {
  const result = identify(text);
  return result.lang === lang && result.confidence >= minConfidence;
}
