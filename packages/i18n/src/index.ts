import ckb from "./catalogues/ckb.json" with { type: "json" };
import en from "./catalogues/en.json" with { type: "json" };
import kmr from "./catalogues/kmr.json" with { type: "json" };

export type UiLang = "en" | "ckb" | "kmr";
export type MessageKey = keyof typeof en;
export type Params = Readonly<Record<string, string | number>>;
export type Translate = (key: MessageKey, params?: Params) => string;

const CATALOGUES: Record<UiLang, Readonly<Record<string, string>>> = { en, ckb, kmr };
const LOCALES: Record<UiLang, string> = { en: "en", ckb: "ckb", kmr: "kmr" };
/** Sorani writes Eastern Arabic digits by default; a setting can turn this off. */
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** The direction of an interface language. */
export const dirOf = (lang: UiLang): "ltr" | "rtl" => (lang === "ckb" ? "rtl" : "ltr");

export interface FormatOptions {
  /** Write digits as ٠١٢ in the Sorani interface. On by default. */
  easternDigits?: boolean;
}

export function formatNumber(
  value: number,
  lang: UiLang,
  { easternDigits = true }: FormatOptions = {},
): string {
  const text = new Intl.NumberFormat("en", { maximumFractionDigits: 2, useGrouping: false }).format(value);
  if (lang !== "ckb" || !easternDigits) return text;
  return text.replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)] as string);
}

export function formatPercent(share: number, lang: UiLang, options: FormatOptions = {}): string {
  return `${formatNumber(Math.round(share * 100), lang, options)}%`;
}

const PLURAL = /\{(\w+), plural,((?:\s*\w+ \{[^{}]*\})+)\s*\}/g;
const BRANCH = /(\w+) \{([^{}]*)\}/g;

function selectPlural(body: string, value: number, lang: UiLang): string {
  const branches = new Map(
    Array.from(body.matchAll(BRANCH), (match) => [match[1] as string, match[2] as string]),
  );
  const category = new Intl.PluralRules(LOCALES[lang]).select(value);
  return branches.get(category) ?? branches.get("other") ?? "";
}

/**
 * Render a string: {name} inserts a value as plain text, and {count, plural, one {...} other {...}}
 * chooses by number, with # for the number. Values are never interpreted, and an unknown placeholder
 * stays visible rather than hiding a mistake.
 */
export function render(
  template: string,
  lang: UiLang,
  params: Params = {},
  options: FormatOptions = {},
): string {
  const show = (value: string | number) =>
    typeof value === "number" ? formatNumber(value, lang, options) : value;
  const withPlurals = template.replace(PLURAL, (whole, name: string, body: string) => {
    const value = params[name];
    if (typeof value !== "number") return whole;
    return selectPlural(body, value, lang).replaceAll("#", show(value));
  });
  return withPlurals.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : show(value);
  });
}

/** The translate function of an interface language. */
export function createT(lang: UiLang, options: FormatOptions = {}): Translate {
  const catalogue = CATALOGUES[lang];
  return (key, params) => render(catalogue[key] ?? key, lang, params, options);
}

export const UI_LANGS: readonly UiLang[] = ["en", "ckb", "kmr"];

/** Every key, for tools that check the catalogues. */
export const catalogueOf = (lang: UiLang): Readonly<Record<string, string>> => CATALOGUES[lang];
