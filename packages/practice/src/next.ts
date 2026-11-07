import type { Course } from "@zimanyar/content";
import { type Drill, type DrillKind, drillFor, drillIds } from "./drills.js";
import { frequentMistakes } from "./history.js";
import { isDue } from "./sm2.js";
import { matches, type PracticeFilter, type PracticeState } from "./state.js";

const idsCache = new Map<string, string[]>();
const idsOf = (lang: Course, kind: DrillKind): string[] => {
  const key = `${lang}:${kind}`;
  let ids = idsCache.get(key);
  if (ids === undefined) {
    ids = drillIds(lang, kind);
    idsCache.set(key, ids);
  }
  return ids;
};

/** New drills are chosen at random from this many of the next ones, so that a session is not a list. */
const NEW_WINDOW = 8;

/**
 * The next drill: the one due longest first, then a new one. New spot drills for the writer's frequent
 * mistakes come before other new drills. `skip` holds drills already seen in this session.
 */
export function nextDrill(
  state: PracticeState,
  filter: PracticeFilter,
  now: number,
  skip: ReadonlySet<string> = new Set(),
  random: () => number = Math.random,
): Drill | null {
  const due = Object.entries(state.cards)
    .filter(([id, card]) => !skip.has(id) && isDue(card, now) && matches(id, filter))
    .sort(([, a], [, b]) => a.due - b.due);
  for (const [id] of due) {
    const drill = drillFor(id);
    if (drill !== null) return drill;
  }
  const fresh = (id: string) => !skip.has(id) && state.cards[id] === undefined;
  if (filter.kinds.includes("spot")) {
    const rules = frequentMistakes(state.mistakes, now).map(({ rule }) => rule);
    for (const id of idsOf(filter.lang, "spot")) {
      const rule = id.split(":")[1] as string;
      if (rules.includes(rule) && fresh(id)) {
        const drill = drillFor(id);
        if (drill !== null) return drill;
      }
    }
  }
  const kinds = [...filter.kinds];
  // Start from a random kind, and go on to the others when one has nothing left.
  const first = Math.floor(random() * kinds.length);
  for (let step = 0; step < kinds.length; step += 1) {
    const kind = kinds[(first + step) % kinds.length] as DrillKind;
    const window = idsOf(filter.lang, kind).filter(fresh).slice(0, NEW_WINDOW);
    while (window.length > 0) {
      const [id] = window.splice(Math.floor(random() * window.length), 1) as [string];
      const drill = drillFor(id);
      if (drill !== null) return drill;
    }
  }
  return null;
}
