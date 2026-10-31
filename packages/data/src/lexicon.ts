import { Fsa } from "./fsa.js";

/** How a form's frequency, quality and attestation share one byte. */
const BUCKET_MASK = 0b11111;
const TIER_SHIFT = 5;
const TIER_MASK = 0b11;
const ATTESTED = 1 << 7;

const QUALITY_TIERS = ["bronze", "silver", "gold"] as const;
export type QualityTier = (typeof QUALITY_TIERS)[number];
export type Lang = "ckb" | "kmr";

export const FORMAT_MAGIC = 0x584c4d5a; // "ZMLX", little endian
export const FORMAT_VERSION = 1;
const HEADER_START = 12;

export const SECTION_TYPES = {
  formArcs: 4,
  formAlphabet: 2,
  formLemma: 4,
  formFeatures: 2,
  formMeta: 1,
  lemmaArcs: 4,
  lemmaAlphabet: 2,
  lemmaAttributes: 1,
  lemmaMeta: 1,
  variantArcs: 4,
  variantAlphabet: 2,
  variantTargets: 4,
} as const;
export type SectionName = keyof typeof SECTION_TYPES;

export interface LexiconHeader {
  lang: Lang;
  zimankit: string;
  data: string;
  /** Each form points at one of these: its part of speech and features. */
  featureSets: { upos: string; features: Record<string, string | boolean> }[];
  /** Each lemma points at one of these: part of speech, gender, transitivity. */
  lemmaAttributes: { upos: string; gender?: string; transitivity?: string }[];
  /** The few lemmas with more than attributes: verb stems and cross references. */
  lemmaDetails: Record<string, { present?: string; past?: string; variantOf?: string; seeAlso?: string }>;
  sections: Record<SectionName, { offset: number; length: number }>;
}

export interface FormEntry {
  word: string;
  lemma: string;
  upos: string;
  features: Record<string, string | boolean>;
  /** Zipf frequency in quarter steps, from 0 to 31. */
  frequency: number;
  quality: QualityTier;
  /** False when a form was generated from a paradigm and never seen in the corpus. */
  attested: boolean;
}

export interface LemmaEntry {
  lemma: string;
  upos: string;
  gender?: string;
  transitivity?: string;
  present?: string;
  past?: string;
  variantOf?: string;
  seeAlso?: string;
  /** Zipf frequency in quarter steps, from 0 to 31. */
  frequency: number;
}

export class InvalidLexiconError extends Error {
  override name = "InvalidLexiconError";
}

export function packFormMeta(frequency: number, tier: QualityTier, attested: boolean): number {
  return frequency | (QUALITY_TIERS.indexOf(tier) << TIER_SHIFT) | (attested ? ATTESTED : 0);
}

function section<T extends SectionName>(
  bytes: Uint8Array,
  header: LexiconHeader,
  name: T,
): { buffer: ArrayBuffer; length: number } {
  const entry = header.sections?.[name];
  const unit = SECTION_TYPES[name];
  if (
    !entry ||
    !Number.isSafeInteger(entry.offset) ||
    !Number.isSafeInteger(entry.length) ||
    entry.offset < 0 ||
    entry.length < 0 ||
    entry.offset + entry.length > bytes.length ||
    entry.length % unit !== 0
  ) {
    throw new InvalidLexiconError(`section ${name} is out of bounds`);
  }
  // A copy, because a section's offset need not be aligned within the caller's buffer.
  const copy = bytes.slice(entry.offset, entry.offset + entry.length);
  return { buffer: copy.buffer, length: entry.length / unit };
}

/** A language's lexicon, read from the binary format and checked on the way in. */
export class Lexicon {
  readonly lang: Lang;
  readonly zimankitVersion: string;
  readonly dataVersion: string;
  private readonly forms: Fsa;
  private readonly lemmas: Fsa;
  private readonly variants: Fsa;
  private readonly formLemma: Uint32Array;
  private readonly formFeatures: Uint16Array;
  private readonly formMeta: Uint8Array;
  private readonly lemmaAttributes: Uint8Array;
  private readonly lemmaMeta: Uint8Array;
  private readonly variantTargets: Uint32Array;
  private readonly header: LexiconHeader;

  constructor(bytes: Uint8Array) {
    if (bytes.length < HEADER_START) throw new InvalidLexiconError("too short");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, true) !== FORMAT_MAGIC) throw new InvalidLexiconError("not a Zimanyar lexicon");
    const version = view.getUint32(4, true);
    if (version !== FORMAT_VERSION) throw new InvalidLexiconError(`unsupported format version ${version}`);
    const headerLength = view.getUint32(8, true);
    if (headerLength > bytes.length - HEADER_START) throw new InvalidLexiconError("header is out of bounds");
    let header: LexiconHeader;
    try {
      header = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          bytes.subarray(HEADER_START, HEADER_START + headerLength),
        ),
      ) as LexiconHeader;
    } catch {
      throw new InvalidLexiconError("header is not valid");
    }
    if (header === null || typeof header !== "object") throw new InvalidLexiconError("header is not valid");
    if (header.lang !== "ckb" && header.lang !== "kmr") throw new InvalidLexiconError("unknown language");
    if (!Array.isArray(header.featureSets) || !Array.isArray(header.lemmaAttributes)) {
      throw new InvalidLexiconError("header is not valid");
    }
    this.header = header;
    this.lang = header.lang;
    this.zimankitVersion = header.zimankit;
    this.dataVersion = header.data;

    const get = <T extends SectionName>(name: T) => section(bytes, header, name);
    this.forms = new Fsa(
      new Uint32Array(get("formArcs").buffer),
      new Uint16Array(get("formAlphabet").buffer),
    );
    this.lemmas = new Fsa(
      new Uint32Array(get("lemmaArcs").buffer),
      new Uint16Array(get("lemmaAlphabet").buffer),
    );
    this.variants = new Fsa(
      new Uint32Array(get("variantArcs").buffer),
      new Uint16Array(get("variantAlphabet").buffer),
    );
    this.formLemma = new Uint32Array(get("formLemma").buffer);
    this.formFeatures = new Uint16Array(get("formFeatures").buffer);
    this.formMeta = new Uint8Array(get("formMeta").buffer);
    this.lemmaAttributes = new Uint8Array(get("lemmaAttributes").buffer);
    this.lemmaMeta = new Uint8Array(get("lemmaMeta").buffer);
    this.variantTargets = new Uint32Array(get("variantTargets").buffer);

    const formCount = this.forms.wordCount;
    const lemmaCount = this.lemmas.wordCount;
    const sizes: [Uint8Array | Uint16Array | Uint32Array, number, string][] = [
      [this.formLemma, formCount, "formLemma"],
      [this.formFeatures, formCount, "formFeatures"],
      [this.formMeta, formCount, "formMeta"],
      [this.lemmaAttributes, lemmaCount, "lemmaAttributes"],
      [this.lemmaMeta, lemmaCount, "lemmaMeta"],
      [this.variantTargets, this.variants.wordCount, "variantTargets"],
    ];
    for (const [column, expected, name] of sizes) {
      if (column.length !== expected) throw new InvalidLexiconError(`${name} has the wrong length`);
    }
    const inRange = (column: Uint8Array | Uint16Array | Uint32Array, limit: number, name: string) => {
      for (const value of column) {
        if (value >= limit) throw new InvalidLexiconError(`${name} points outside its table`);
      }
    };
    inRange(this.formLemma, lemmaCount, "formLemma");
    inRange(this.formFeatures, header.featureSets.length, "formFeatures");
    inRange(this.lemmaAttributes, header.lemmaAttributes.length, "lemmaAttributes");
    inRange(this.variantTargets, formCount, "variantTargets");
  }

  get formCount(): number {
    return this.forms.wordCount;
  }

  get lemmaCount(): number {
    return this.lemmas.wordCount;
  }

  /** The form automaton, for searches that walk it: suggestions and completion. */
  get automaton(): Fsa {
    return this.forms;
  }

  has(word: string): boolean {
    return this.forms.has(word);
  }

  form(word: string): FormEntry | null {
    const rank = this.forms.rank(word);
    return rank < 0 ? null : this.formAt(rank);
  }

  formAt(rank: number): FormEntry {
    const word = this.forms.wordAt(rank);
    const meta = this.formMeta[rank] as number;
    const set = this.header.featureSets[
      this.formFeatures[rank] as number
    ] as LexiconHeader["featureSets"][number];
    return {
      word,
      lemma: this.lemmas.wordAt(this.formLemma[rank] as number),
      upos: set.upos,
      features: set.features,
      frequency: meta & BUCKET_MASK,
      quality: QUALITY_TIERS[(meta >>> TIER_SHIFT) & TIER_MASK] ?? "bronze",
      attested: (meta & ATTESTED) !== 0,
    };
  }

  /** How frequent a form is, without building its entry: for ranking many candidates. */
  frequencyAt(rank: number): number {
    return (this.formMeta[rank] as number) & BUCKET_MASK;
  }

  /** False when a form was generated from a paradigm and never seen in the corpus. */
  attestedAt(rank: number): boolean {
    return ((this.formMeta[rank] as number) & ATTESTED) !== 0;
  }

  lemma(lemma: string): LemmaEntry | null {
    const rank = this.lemmas.rank(lemma);
    if (rank < 0) return null;
    const attributes = this.header.lemmaAttributes[
      this.lemmaAttributes[rank] as number
    ] as LexiconHeader["lemmaAttributes"][number];
    return {
      lemma,
      ...attributes,
      ...this.header.lemmaDetails?.[rank],
      frequency: this.lemmaMeta[rank] as number,
    };
  }

  /** The standard spelling of a known non-standard one. */
  standardSpelling(variant: string): string | null {
    const rank = this.variants.rank(variant);
    return rank < 0 ? null : this.forms.wordAt(this.variantTargets[rank] as number);
  }
}
