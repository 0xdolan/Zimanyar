import { buildFsa } from "./fsa-builder.js";
import {
  FORMAT_MAGIC,
  FORMAT_VERSION,
  type Lang,
  type LexiconHeader,
  packFormMeta,
  type QualityTier,
  SECTION_TYPES,
  type SectionName,
} from "./lexicon.js";

export interface FormRow {
  word: string;
  lemma: string;
  upos: string;
  /** JSON of the form's features. */
  features: string;
  attested: boolean;
  zipf: number;
  quality: QualityTier;
}

export interface LemmaRow {
  lemma: string;
  upos: string;
  gender?: string;
  transitivity?: string;
  present?: string;
  past?: string;
  variantOf?: string;
  seeAlso?: string;
  zipf: number;
  /** How often the lemma occurs in the corpus. */
  count?: number;
}

export interface LexiconInput {
  lang: Lang;
  zimankit: string;
  data: string;
  forms: readonly FormRow[];
  lemmas: readonly LemmaRow[];
  variants: readonly { variant: string; standard: string }[];
}

/** Zipf frequency (about 0 to 8) in quarter steps, to fit five bits. */
export function frequencyBucket(zipf: number): number {
  return Math.max(0, Math.min(31, Math.round(zipf * 4)));
}

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function interned<T>(values: T[], index: Map<string, number>, key: string, make: () => T): number {
  let id = index.get(key);
  if (id === undefined) {
    id = values.length;
    values.push(make());
    index.set(key, id);
  }
  return id;
}

/** Compile a lexicon into the binary format that Lexicon reads. The same input gives the same bytes. */
export function buildLexicon(input: LexiconInput): Uint8Array {
  const forms = [...input.forms].sort((a, b) => compare(a.word, b.word));
  const lemmas = [...input.lemmas].sort((a, b) => compare(a.lemma, b.lemma));
  const variants = [...input.variants].sort((a, b) => compare(a.variant, b.variant));

  const formFsa = buildFsa(forms.map((row) => row.word));
  const lemmaFsa = buildFsa(lemmas.map((row) => row.lemma));
  const variantFsa = buildFsa(variants.map((row) => row.variant));

  const featureSets: LexiconHeader["featureSets"] = [];
  const featureIndex = new Map<string, number>();
  const formLemma = new Uint32Array(forms.length);
  const formFeatures = new Uint16Array(forms.length);
  const formMeta = new Uint8Array(forms.length);
  forms.forEach((row, rank) => {
    const lemma = lemmaFsa.rank(row.lemma);
    if (lemma < 0) throw new Error(`form ${row.word} has an unknown lemma ${row.lemma}`);
    formLemma[rank] = lemma;
    formFeatures[rank] = interned(featureSets, featureIndex, `${row.upos}\t${row.features}`, () => ({
      upos: row.upos,
      features: JSON.parse(row.features),
    }));
    formMeta[rank] = packFormMeta(frequencyBucket(row.zipf), row.quality, row.attested);
  });
  if (featureSets.length > 0xffff) throw new Error("too many feature sets");

  const lemmaAttributes: LexiconHeader["lemmaAttributes"] = [];
  const attributeIndex = new Map<string, number>();
  const lemmaDetails: LexiconHeader["lemmaDetails"] = {};
  const attributeColumn = new Uint8Array(lemmas.length);
  const lemmaMeta = new Uint8Array(lemmas.length);
  const lemmaFrequency = new Uint32Array(lemmas.length);
  lemmas.forEach((row, rank) => {
    attributeColumn[rank] = interned(
      lemmaAttributes,
      attributeIndex,
      `${row.upos}\t${row.gender ?? ""}\t${row.transitivity ?? ""}`,
      () => ({
        upos: row.upos,
        ...(row.gender ? { gender: row.gender } : {}),
        ...(row.transitivity ? { transitivity: row.transitivity } : {}),
      }),
    );
    lemmaMeta[rank] = frequencyBucket(row.zipf);
    lemmaFrequency[rank] = row.count ?? 0;
    const details = {
      ...(row.present ? { present: row.present } : {}),
      ...(row.past ? { past: row.past } : {}),
      ...(row.variantOf ? { variantOf: row.variantOf } : {}),
      ...(row.seeAlso ? { seeAlso: row.seeAlso } : {}),
    };
    if (Object.keys(details).length > 0) lemmaDetails[rank] = details;
  });
  if (lemmaAttributes.length > 0xff) throw new Error("too many lemma attribute sets");

  const variantTargets = new Uint32Array(variants.length);
  variants.forEach((row, rank) => {
    const target = formFsa.rank(row.standard);
    if (target < 0) throw new Error(`variant ${row.variant} points at an unknown form ${row.standard}`);
    variantTargets[rank] = target;
  });

  const columns: Record<SectionName, Uint8Array | Uint16Array | Uint32Array> = {
    formArcs: formFsa.tables.arcs,
    formAlphabet: formFsa.tables.alphabet,
    formLemma,
    formFeatures,
    formMeta,
    lemmaArcs: lemmaFsa.tables.arcs,
    lemmaAlphabet: lemmaFsa.tables.alphabet,
    lemmaAttributes: attributeColumn,
    lemmaMeta,
    lemmaFrequency,
    variantArcs: variantFsa.tables.arcs,
    variantAlphabet: variantFsa.tables.alphabet,
    variantTargets,
  };

  // Sections are relative to a header whose length depends on the offsets, so offsets are
  // padded to a fixed width by laying the sections out after a first measurement.
  const names = Object.keys(SECTION_TYPES) as SectionName[];
  const headerWithout: Omit<LexiconHeader, "sections"> = {
    lang: input.lang,
    zimankit: input.zimankit,
    data: input.data,
    featureSets,
    lemmaAttributes,
    lemmaDetails,
  };
  const encoder = new TextEncoder();
  const layout = (base: number): LexiconHeader["sections"] => {
    const sections = {} as LexiconHeader["sections"];
    let offset = base;
    for (const name of names) {
      const column = columns[name];
      sections[name] = { offset, length: column.byteLength };
      offset += column.byteLength;
    }
    return sections;
  };
  let base = 0;
  let headerBytes = new Uint8Array(0);
  for (let attempt = 0; attempt < 8; attempt++) {
    headerBytes = encoder.encode(JSON.stringify({ ...headerWithout, sections: layout(base) }));
    const next = 12 + headerBytes.length;
    if (next === base) break;
    base = next;
  }
  if (12 + headerBytes.length !== base) throw new Error("the header layout did not settle");

  const total = names.reduce((sum, name) => sum + columns[name].byteLength, base);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, FORMAT_MAGIC, true);
  view.setUint32(4, FORMAT_VERSION, true);
  view.setUint32(8, headerBytes.length, true);
  out.set(headerBytes, 12);
  let offset = base;
  for (const name of names) {
    const column = columns[name];
    out.set(new Uint8Array(column.buffer, column.byteOffset, column.byteLength), offset);
    offset += column.byteLength;
  }
  return out;
}
