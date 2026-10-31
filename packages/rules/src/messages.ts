import { CATALOGUE } from "./generated/catalogue.js";
import type { Category, LessonRef, MessageRef, RuleExample, RuleLang, Severity } from "./model.js";

export type UiLang = "en" | "ckb" | "kmr";

export interface RuleMeta {
  id: string;
  lang: RuleLang;
  family: string;
  category: Category;
  severity: Severity;
  confidence: number;
  safeFix: boolean;
  /** Only in the written standard: Tolerant mode accepts what this rule flags. */
  standardOnly: boolean;
  /** A neutral notice about a whole paragraph, not a mistake to fix. */
  notice: boolean;
  message: Record<UiLang, string>;
  reason: Record<UiLang, string>;
  examples: readonly RuleExample[];
  lessons: readonly LessonRef[];
}

const metas = new Map<string, RuleMeta>((CATALOGUE as unknown as RuleMeta[]).map((meta) => [meta.id, meta]));

export function ruleMeta(id: string): RuleMeta {
  const meta = metas.get(id);
  if (meta === undefined) throw new Error(`no metadata for rule ${id}`);
  return meta;
}

export const allRuleMeta = (): readonly RuleMeta[] => [...metas.values()];

/**
 * The text of a finding's message or reason in an interface language. Values are inserted as plain
 * text and never interpreted, and an unknown placeholder is left visible rather than dropped.
 */
export function renderMessage(ref: MessageRef, lang: UiLang): string {
  const [, id = "", part = ""] = /^rule\.(.+)\.(message|reason)$/.exec(ref.key) ?? [];
  const meta = metas.get(id);
  if (meta === undefined) return ref.key;
  const template = meta[part as "message" | "reason"][lang];
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => ref.params?.[name] ?? whole);
}
