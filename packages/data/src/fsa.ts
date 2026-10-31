/**
 * A minimal acyclic finite-state automaton over UTF-16 code units.
 *
 * Each arc is one 32-bit word: label (8 bits), last arc of its node (1), a word ends on this
 * arc (1), target node (22). A node is a run of arcs in label order and is addressed by its
 * first arc. Arc 0 is a sentinel meaning "no arcs", and children are stored before parents,
 * so the root is the last node. Word ranks in sorted order are derived on load, which is what
 * lets a word's data live in plain columns indexed by rank.
 */
const LABEL_SHIFT = 24;
const LAST = 1 << 23;
const FINAL = 1 << 22;
const TARGET_MASK = FINAL - 1;

export const MAX_ARCS = TARGET_MASK + 1;
export const MAX_ALPHABET = 255;

export function encodeArc(label: number, last: boolean, final: boolean, target: number): number {
  return ((label << LABEL_SHIFT) | (last ? LAST : 0) | (final ? FINAL : 0) | target) >>> 0;
}

export class InvalidFsaError extends Error {
  override name = "InvalidFsaError";
}

export class Fsa {
  readonly wordCount: number;
  private readonly root: number;
  /** Code unit to label + 1; 0 for a code unit outside the alphabet. */
  private readonly labelOf = new Uint8Array(0x10000);
  /** Words in the earlier arcs of the same node, for each arc. */
  private readonly rankBefore: Uint32Array;
  /** Words below each node, at the node's first arc. */
  private readonly counts: Uint32Array;

  /** Every arc is checked here, so a damaged file fails on load rather than in a lookup. */
  constructor(
    private readonly arcs: Uint32Array,
    private readonly alphabet: Uint16Array,
  ) {
    if (arcs.length === 0 || arcs.length > MAX_ARCS) throw new InvalidFsaError("bad arc count");
    if (alphabet.length > MAX_ALPHABET) throw new InvalidFsaError("alphabet too large");
    alphabet.forEach((codeUnit, label) => {
      this.labelOf[codeUnit] = label + 1;
    });
    this.rankBefore = new Uint32Array(arcs.length);
    this.counts = new Uint32Array(arcs.length);

    let node = 0;
    let start = 1;
    let total = 0;
    let previousLabel = -1;
    for (let arc = 1; arc < arcs.length; arc++) {
      const word = arcs[arc] as number;
      const label = word >>> LABEL_SHIFT;
      const target = word & TARGET_MASK;
      if (label >= alphabet.length) throw new InvalidFsaError("label outside the alphabet");
      if (label <= previousLabel) throw new InvalidFsaError("labels out of order");
      if (target >= start) throw new InvalidFsaError("target is not an earlier node");
      this.rankBefore[arc] = total;
      total += (word & FINAL ? 1 : 0) + (this.counts[target] as number);
      previousLabel = label;
      if (word & LAST) {
        this.counts[start] = total;
        node = start;
        start = arc + 1;
        total = 0;
        previousLabel = -1;
      }
    }
    if (start !== arcs.length) throw new InvalidFsaError("the last node is not closed");
    this.root = node;
    this.wordCount = node === 0 ? 0 : (this.counts[node] as number);
  }

  /** The word's position in sorted order, or -1 if it is not in the automaton. */
  rank(word: string): number {
    const { arcs, labelOf, rankBefore } = this;
    let node = this.root;
    let rank = 0;
    const end = word.length - 1;
    if (end < 0 || node === 0) return -1;
    for (let i = 0; i <= end; i++) {
      const wanted = (labelOf[word.charCodeAt(i)] as number) - 1;
      if (wanted < 0) return -1;
      let arc = node;
      for (;;) {
        const current = arcs[arc] as number;
        const label = current >>> LABEL_SHIFT;
        if (label === wanted) break;
        if (label > wanted || current & LAST) return -1;
        arc++;
      }
      const found = arcs[arc] as number;
      rank += rankBefore[arc] as number;
      if (i === end) return found & FINAL ? rank : -1;
      if (found & FINAL) rank++;
      node = found & TARGET_MASK;
      if (node === 0) return -1;
    }
    return -1;
  }

  has(word: string): boolean {
    return this.rank(word) >= 0;
  }

  /** The word at a rank, the inverse of rank(). */
  wordAt(rank: number): string {
    if (!Number.isInteger(rank) || rank < 0 || rank >= this.wordCount) {
      throw new RangeError(`no word at rank ${rank}`);
    }
    const { arcs, counts, rankBefore, alphabet } = this;
    const units: number[] = [];
    let node = this.root;
    let left = rank;
    for (;;) {
      let arc = node;
      for (;;) {
        const current = arcs[arc] as number;
        const weight = (current & FINAL ? 1 : 0) + (counts[current & TARGET_MASK] as number);
        if (left < (rankBefore[arc] as number) + weight) break;
        arc++;
      }
      const found = arcs[arc] as number;
      left -= rankBefore[arc] as number;
      units.push(alphabet[found >>> LABEL_SHIFT] as number);
      if (found & FINAL) {
        if (left === 0) return String.fromCharCode(...units);
        left--;
      }
      node = found & TARGET_MASK;
    }
  }

  /** The state reached by a prefix (0 is the start state), or -1. */
  private stateAfter(prefix: string): { node: number; rank: number; final: boolean } | null {
    const { arcs, labelOf, rankBefore } = this;
    let node = this.root;
    let rank = 0;
    let final = false;
    for (let i = 0; i < prefix.length; i++) {
      if (node === 0) return null;
      const wanted = (labelOf[prefix.charCodeAt(i)] as number) - 1;
      if (wanted < 0) return null;
      let arc = node;
      for (;;) {
        const current = arcs[arc] as number;
        const label = current >>> LABEL_SHIFT;
        if (label === wanted) break;
        if (label > wanted || current & LAST) return null;
        arc++;
      }
      const found = arcs[arc] as number;
      rank += rankBefore[arc] as number;
      if (final) rank++;
      final = (found & FINAL) !== 0;
      node = found & TARGET_MASK;
    }
    return { node, rank, final };
  }

  /** Every word starting with a prefix, in sorted order, with its rank. */
  *withPrefix(prefix: string): Generator<{ word: string; rank: number }> {
    const state = this.stateAfter(prefix);
    if (state === null) return;
    let rank = state.rank;
    if (state.final && prefix !== "") yield { word: prefix, rank: rank++ };
    yield* this.walk(state.node, prefix, rank);
  }

  private *walk(node: number, prefix: string, startRank: number): Generator<{ word: string; rank: number }> {
    if (node === 0) return;
    const { arcs, alphabet, counts } = this;
    let rank = startRank;
    for (let arc = node; ; arc++) {
      const current = arcs[arc] as number;
      const word = prefix + String.fromCharCode(alphabet[current >>> LABEL_SHIFT] as number);
      if (current & FINAL) yield { word, rank: rank++ };
      const target = current & TARGET_MASK;
      yield* this.walk(target, word, rank);
      rank += counts[target] as number;
      if (current & LAST) return;
    }
  }

  /**
   * Visit the arcs of a state, for searches that walk the automaton themselves, such as the
   * bounded edit-distance search for spelling suggestions. Pass `start` for the first state.
   */
  forEachArc(node: number, visit: (codeUnit: number, final: boolean, target: number) => void): void {
    if (node === 0) return;
    const { arcs, alphabet } = this;
    for (let arc = node; ; arc++) {
      const current = arcs[arc] as number;
      visit(alphabet[current >>> LABEL_SHIFT] as number, (current & FINAL) !== 0, current & TARGET_MASK);
      if (current & LAST) return;
    }
  }

  get start(): number {
    return this.root;
  }

  /** The raw tables, for writing the automaton to a file. */
  get tables(): { arcs: Uint32Array; alphabet: Uint16Array } {
    return { arcs: this.arcs, alphabet: this.alphabet };
  }
}
