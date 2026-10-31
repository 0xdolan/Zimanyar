export interface BidiRun {
  text: string;
  /** Null for text with no strong direction, which takes the direction around it. */
  dir: "rtl" | "ltr" | null;
}

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/u;
const LATIN = /\p{Script=Latin}/u;
/** Spaces and the like between two words of one script stay inside that run. */
const WEAK = /[\s‌,.;:!?'،؛؟()-]/u;

/** Split mixed text into runs, so each script can be isolated with its own direction. */
export function splitBidi(text: string): BidiRun[] {
  const runs: BidiRun[] = [];
  let current = "";
  let dir: BidiRun["dir"] = null;
  let weak = "";
  const flush = () => {
    if (current !== "") runs.push({ text: current, dir });
    current = "";
  };
  for (const character of text) {
    const strong = ARABIC.test(character) ? "rtl" : LATIN.test(character) ? "ltr" : null;
    if (strong === null) {
      if (WEAK.test(character) || dir === null) {
        if (dir === null) current += character;
        else weak += character;
      } else {
        current += weak + character;
        weak = "";
      }
    } else if (strong === dir || dir === null) {
      if (dir === null && current !== "") {
        runs.push({ text: current, dir: null });
        current = "";
      }
      current += weak + character;
      weak = "";
      dir = strong;
    } else {
      flush();
      if (weak !== "") runs.push({ text: weak, dir: null });
      weak = "";
      current = character;
      dir = strong;
    }
  }
  flush();
  if (weak !== "") runs.push({ text: weak, dir: null });
  return runs;
}
