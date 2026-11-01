/** One morphological reading of a surface token. */
export interface Analysis {
  surface: string;
  lemma: string;
  /** Universal Dependencies part of speech. */
  pos: string;
  features: Record<string, string>;
  /** Morph and tag, in written order. */
  segments: [morph: string, tag: string][];
  score: number;
}

/** The morphemes of a reading, joined by +. */
export function segmentation(analysis: Analysis): string {
  return analysis.segments.length > 0
    ? analysis.segments.map(([morph]) => morph).join("+")
    : analysis.surface;
}

/** The tags of a reading, joined by +. */
export function gloss(analysis: Analysis): string {
  return analysis.segments.length > 0 ? analysis.segments.map(([, tag]) => tag).join("+") : "STEM";
}

/** What the analyzers need from a lexicon: membership, part of speech, frequency and gender. */
export interface LexiconLike {
  has(word: string): boolean;
  posOf(word: string): ReadonlySet<string>;
  freq(word: string): number;
  genderOf(word: string): string | null;
}

const NO_POS: ReadonlySet<string> = new Set();

export const emptyLexicon: LexiconLike = {
  has: () => false,
  posOf: () => NO_POS,
  freq: () => 0,
  genderOf: () => null,
};

/** An in-memory lexicon, for tests and small word lists. */
export class SimpleLexicon implements LexiconLike {
  private readonly entries = new Map<string, { pos: Set<string>; gender: string | null }>();
  private readonly frequencies = new Map<string, number>();

  add(lemma: string, pos: string | null = null, gender: string | null = null, frequency?: number): void {
    let entry = this.entries.get(lemma);
    if (entry === undefined) {
      entry = { pos: new Set(), gender: null };
      this.entries.set(lemma, entry);
    }
    if (pos) entry.pos.add(pos);
    if (gender && !entry.gender) entry.gender = gender;
    if (frequency !== undefined) this.frequencies.set(lemma, frequency);
  }

  has(word: string): boolean {
    return this.entries.has(word);
  }

  posOf(word: string): ReadonlySet<string> {
    return this.entries.get(word)?.pos ?? NO_POS;
  }

  freq(word: string): number {
    return this.frequencies.get(word) ?? 0;
  }

  genderOf(word: string): string | null {
    return this.entries.get(word)?.gender ?? null;
  }
}

/** Parse a function word table: word, part of speech, and key=value features. First entry wins. */
export function parseFunctionWords(
  tsv: string,
): Map<string, [pos: string, features: Record<string, string>]> {
  const out = new Map<string, [string, Record<string, string>]>();
  for (const line of tsv.split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const [word = "", pos = "", features = ""] = line.split("\t");
    if (out.has(word)) continue;
    const parsed: Record<string, string> = {};
    for (const pair of features.split("|")) {
      const at = pair.indexOf("=");
      if (at >= 0) parsed[pair.slice(0, at)] = pair.slice(at + 1);
    }
    out.set(word, [pos, parsed]);
  }
  return out;
}
