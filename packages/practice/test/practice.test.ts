import lessons from "@zimanyar/rules/lessons.json" with { type: "json" };
import { describe, expect, it } from "vitest";
import { MAX_MISTAKES } from "../src/history.js";
import {
  answer,
  DAY,
  type Drill,
  drillFor,
  drillIds,
  emptyPractice,
  frequentMistakes,
  isRight,
  nextDrill,
  parsePractice,
  progress,
  recommendLessons,
  recordMistake,
  review,
} from "../src/index.js";
import { newCard } from "../src/sm2.js";
import { dateOf } from "../src/state.js";

const NOW = new Date(2026, 10, 7, 12).getTime();
const first = () => 0;

describe("SM-2", () => {
  it("waits one day, then six, then the last wait times the ease", () => {
    let card = newCard(NOW);
    card = review(card, 4, NOW);
    expect([card.reps, card.interval, card.due]).toEqual([1, 1, NOW + DAY]);
    card = review(card, 4, NOW);
    expect(card.interval).toBe(6);
    card = review(card, 4, NOW);
    expect(card.interval).toBe(15);
    expect(card.ease).toBe(2.5);
  });

  it("raises the ease for a perfect answer and lowers it for a hard one", () => {
    expect(review(newCard(NOW), 5, NOW).ease).toBe(2.6);
    expect(review(newCard(NOW), 3, NOW).ease).toBe(2.36);
  });

  it("starts a card over after a wrong answer, keeping its ease", () => {
    let card = review(review(review(newCard(NOW), 4, NOW), 4, NOW), 4, NOW);
    card = review(card, 1, NOW);
    expect(card).toMatchObject({ reps: 0, interval: 1, lapses: 1, ease: 2.5, due: NOW + DAY });
  });

  it("never lets the ease fall below 1.3", () => {
    let card = newCard(NOW);
    for (let i = 0; i < 20; i += 1) card = review(card, 3, NOW);
    expect(card.ease).toBe(1.3);
  });
});

describe("verb drills", () => {
  it("make the past of a transitive Kurmanji verb agree with the object", () => {
    const drill = drillFor("verb:kmr:dîtin:past:2sg");
    expect(drill).toMatchObject({ kind: "verb", answer: "dîtî", after: "." });
    if (drill?.kind !== "verb") throw new Error("not a verb drill");
    // The agent is oblique and not the object.
    expect(drill.before).toMatch(/^(Min|Wî|Me|We|Wan) tu$/);
    expect(drill.lesson).toMatchObject({ lang: "kmr", lessonId: 14, anchor: "the-big-switch" });
  });

  it("give the subject of an intransitive verb", () => {
    expect(drillFor("verb:kmr:hatin:past:1sg")).toMatchObject({ before: "Ez", answer: "hatim" });
  });

  it("give the Sorani past with the agent's ending", () => {
    expect(drillFor("verb:ckb:خواردن:past:1sg")).toMatchObject({ before: "من", answer: "خواردم" });
  });

  it("put the person of an imperative in brackets", () => {
    expect(drillFor("verb:ckb:هاتن:imperative:2sg")).toMatchObject({
      before: "(تۆ)",
      answer: "وەرە",
      after: "!",
    });
  });

  it("is the same drill every time for the same id", () => {
    expect(drillFor("verb:kmr:dîtin:past:1sg")).toEqual(drillFor("verb:kmr:dîtin:past:1sg"));
  });

  it("leaves imperatives to the second person", () => {
    const persons = drillIds("kmr", "verb")
      .filter((id) => id.includes(":imperative:"))
      .map((id) => id.split(":")[4]);
    expect(new Set(persons)).toEqual(new Set(["2sg", "2pl"]));
  });
});

describe("noun drills", () => {
  it("know a Kurmanji noun's gender", () => {
    expect(drillFor("noun:kmr:mal:def.obl.sg")).toMatchObject({
      gender: "f",
      answer: "malê",
      meaning: "house, home",
    });
  });

  it("decline Sorani nouns", () => {
    expect(drillFor("noun:ckb:پیاو:def.sg")).toMatchObject({ answer: "پیاوەکە" });
  });
});

describe("spot drills", () => {
  it("come from a rule's examples, with its first lesson", () => {
    const drill = drillFor("spot:kmr.ergative.agreement:0");
    expect(drill).toMatchObject({ answer: "Min tu dîtî.", lesson: { lessonId: 14 } });
    if (drill?.kind !== "spot") throw new Error("not a spot drill");
    expect([...drill.choices].sort()).toEqual(["Min tu dîtim.", "Min tu dîtî."]);
  });

  it("put the right sentence first for some drills and second for others", () => {
    const places = drillIds("ckb", "spot").map((id) => {
      const drill = drillFor(id) as Extract<Drill, { kind: "spot" }>;
      return drill.choices.indexOf(drill.answer);
    });
    expect(new Set(places)).toEqual(new Set([0, 1]));
  });

  it("leave out notices and rules for both varieties", () => {
    const ids = [...drillIds("ckb", "spot"), ...drillIds("kmr", "spot")];
    expect(ids.every((id) => /^spot:(ckb|kmr)\./.test(id))).toBe(true);
  });
});

describe("every drill", () => {
  const all = (["ckb", "kmr"] as const).flatMap((lang) =>
    (["verb", "noun", "spot"] as const).flatMap((kind) => drillIds(lang, kind)),
  );

  it("exists, with an answer", () => {
    for (const id of all) {
      const drill = drillFor(id);
      expect(drill, id).not.toBeNull();
      expect(drill?.answer, id).not.toBe("");
    }
  });

  it("links a lesson section that exists", () => {
    const index = lessons as unknown as Record<string, Record<string, { anchors: string[] }>>;
    const seen = new Set<string>();
    for (const id of all) {
      const { lesson } = drillFor(id) as Drill;
      const key = `${lesson.lang}:${lesson.lessonId}:${lesson.anchor}`;
      if (seen.has(key)) continue;
      seen.add(key);
      expect(index[lesson.lang]?.[String(lesson.lessonId)]?.anchors, key).toContain(lesson.anchor);
    }
  });

  it("has ids without repeats", () => {
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("ids that name nothing", () => {
  it.each([
    "verb:kmr:dîtin:past:4sg",
    "verb:kmr:dîtin:future:1sg",
    "verb:xx:dîtin:past:1sg",
    "verb:kmr:qqqq:past:1sg",
    "noun:kmr:mal:def.sg",
    "noun:kmr:qqqq:def.obl.sg",
    "spot:no.such.rule:0",
    "spot:kmr.ergative.agreement:9",
    "spot:kmr.ergative.agreement:x",
    "other:thing",
    "",
  ])("%s gives no drill", (id) => {
    expect(drillFor(id)).toBeNull();
  });
});

describe("answers", () => {
  const verb = drillFor("verb:kmr:dîtin:past:2sg") as Drill;
  const sorani = drillFor("verb:ckb:خواردن:past:1sg") as Drill;
  const spot = drillFor("spot:kmr.ergative.agreement:0") as Drill;

  it("ignore case, outer spaces and a final full stop", () => {
    expect(isRight(verb, "dîtî")).toBe(true);
    expect(isRight(verb, "  Dîtî. ")).toBe(true);
  });

  it("accept Sorani typed with Arabic letters", () => {
    // ي and ك from an Arabic keyboard normalise to ی and ک; here the Arabic heh does not matter.
    expect(isRight(sorani, "خواردم")).toBe(true);
    expect(isRight(sorani, "خواردم؟")).toBe(true);
  });

  it("refuse a wrong form and an empty answer", () => {
    expect(isRight(verb, "dîtim")).toBe(false);
    expect(isRight(verb, "")).toBe(false);
    expect(isRight(verb, " . ")).toBe(false);
  });

  it("take the chosen sentence for a spot drill", () => {
    expect(isRight(spot, "Min tu dîtî.")).toBe(true);
    expect(isRight(spot, "Min tu dîtim.")).toBe(false);
  });
});

describe("mistake history", () => {
  const mistakes = (rule: string, action: "applied" | "ignored", count: number, at = NOW) =>
    Array.from({ length: count }, () => ({ rule, action, at }));

  it("counts fixed findings more than dismissed ones", () => {
    const found = frequentMistakes(
      [
        ...mistakes("kmr.ergative.agreement", "ignored", 3),
        ...mistakes("ckb.morph.definite-allomorph", "applied", 2),
      ],
      NOW,
    );
    expect(found.map(({ rule }) => rule)).toEqual(["ckb.morph.definite-allomorph", "kmr.ergative.agreement"]);
    expect(found[1]).toMatchObject({ applied: 0, ignored: 3, weight: 1.5 });
  });

  it("lets older mistakes count less", () => {
    const found = frequentMistakes(
      [
        ...mistakes("kmr.ergative.agreement", "applied", 3, NOW - 90 * DAY),
        ...mistakes("ckb.morph.definite-allomorph", "applied", 1),
      ],
      NOW,
    );
    expect(found[0]?.rule).toBe("ckb.morph.definite-allomorph");
    expect(found[1]?.weight).toBeCloseTo(0.375);
  });

  it("leaves out unknown rules and notices", () => {
    expect(frequentMistakes([...mistakes("no.such.rule", "applied", 5)], NOW)).toEqual([]);
  });

  it("recommends each rule's first lesson, joining rules that share one", () => {
    const recommended = recommendLessons(
      [
        ...mistakes("kmr.ergative.agreement", "applied", 2),
        ...mistakes("ckb.morph.definite-allomorph", "applied", 2),
        ...mistakes("kmr.ergative.direct-agent", "applied", 1),
      ],
      NOW,
    );
    expect(recommended[0]).toMatchObject({
      lesson: { lang: "kmr", lessonId: 14 },
      weight: 3,
      rules: ["kmr.ergative.agreement", "kmr.ergative.direct-agent"],
    });
    expect(recommended).toHaveLength(2);
  });

  it("keeps the newest mistakes only", () => {
    let state = emptyPractice();
    for (let i = 0; i < MAX_MISTAKES + 10; i += 1)
      state = recordMistake(state, "kmr.ergative.agreement", "applied", i);
    expect(state.mistakes).toHaveLength(MAX_MISTAKES);
    expect(state.mistakes[0]?.at).toBe(10);
  });
});

describe("stored practice", () => {
  it("survives a round trip", () => {
    let state = answer(emptyPractice(), "verb:kmr:dîtin:past:2sg", true, NOW);
    state = recordMistake(state, "kmr.ergative.agreement", "applied", NOW);
    expect(parsePractice(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it.each([null, undefined, 3, "x", []])("starts empty from %j", (stored) => {
    expect(parsePractice(stored)).toEqual(emptyPractice());
  });

  it("drops damaged entries and keeps the rest", () => {
    const good = { ease: 2.5, interval: 1, reps: 1, lapses: 0, due: NOW };
    const parsed = parsePractice({
      cards: { "verb:kmr:dîtin:past:2sg": good, "verb:kmr:dîtin:past:1sg": { ease: "x" }, "<script>": good },
      mistakes: [{ rule: "kmr.ergative.agreement", action: "applied", at: NOW }, { rule: 3 }, "x"],
      days: { "2026-11-07": { right: 1, wrong: 0 }, yesterday: { right: 1, wrong: 0 } },
    });
    expect(Object.keys(parsed.cards)).toEqual(["verb:kmr:dîtin:past:2sg"]);
    expect(parsed.mistakes).toHaveLength(1);
    expect(Object.keys(parsed.days)).toEqual(["2026-11-07"]);
  });
});

describe("the next drill", () => {
  const verbs = { lang: "kmr", kinds: ["verb"] } as const;

  it("is a new one when nothing is due", () => {
    const drill = nextDrill(emptyPractice(), verbs, NOW, new Set(), first);
    expect(drill?.id).toBe(drillIds("kmr", "verb")[0]);
  });

  it("is the one due longest", () => {
    let state = answer(emptyPractice(), "verb:kmr:hatin:past:1sg", false, NOW - 3 * DAY);
    state = answer(state, "verb:kmr:dîtin:past:2sg", false, NOW - 5 * DAY);
    expect(nextDrill(state, verbs, NOW, new Set(), first)?.id).toBe("verb:kmr:dîtin:past:2sg");
  });

  it("waits for a drill that is not due", () => {
    const id = drillIds("kmr", "verb")[0] as string;
    const state = answer(emptyPractice(), id, true, NOW);
    expect(nextDrill(state, verbs, NOW, new Set(), first)?.id).not.toBe(id);
  });

  it("skips drills already seen in this session", () => {
    const id = drillIds("kmr", "verb")[0] as string;
    expect(nextDrill(emptyPractice(), verbs, NOW, new Set([id]), first)?.id).not.toBe(id);
  });

  it("keeps to the chosen variety and kinds", () => {
    const state = answer(emptyPractice(), "verb:ckb:خواردن:past:1sg", false, NOW - DAY * 2);
    const drill = nextDrill(state, { lang: "kmr", kinds: ["noun"] }, NOW, new Set(), first);
    expect(drill?.id).toMatch(/^noun:kmr:/);
  });

  it("starts with the writer's frequent mistakes", () => {
    const state = recordMistake(emptyPractice(), "kmr.ergative.agreement", "applied", NOW);
    const drill = nextDrill(state, { lang: "kmr", kinds: ["verb", "spot"] }, NOW, new Set(), first);
    expect(drill?.id).toMatch(/^spot:kmr\.ergative\.agreement:/);
  });

  it("moves on to another kind when one has nothing left", () => {
    const spots = new Set(drillIds("kmr", "spot"));
    const drill = nextDrill(emptyPractice(), { lang: "kmr", kinds: ["spot", "noun"] }, NOW, spots, first);
    expect(drill?.kind).toBe("noun");
  });

  it("is null when nothing is left", () => {
    const spots = new Set(drillIds("kmr", "spot"));
    expect(nextDrill(emptyPractice(), { lang: "kmr", kinds: ["spot"] }, NOW, spots, first)).toBeNull();
  });

  it("chooses new drills from the next few, at random", () => {
    const ids = new Set(
      [0, 0.3, 0.6, 0.99].map((value) => nextDrill(emptyPractice(), verbs, NOW, new Set(), () => value)?.id),
    );
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe("progress", () => {
  const filter = { lang: "kmr", kinds: ["verb", "noun", "spot"] } as const;

  it("counts drills due, seen and known well", () => {
    let state = answer(emptyPractice(), "verb:kmr:dîtin:past:2sg", false, NOW - 2 * DAY);
    state = answer(state, "verb:kmr:hatin:past:1sg", true, NOW);
    state.cards["noun:kmr:mal:def.obl.sg"] = {
      ease: 2.5,
      interval: 30,
      reps: 4,
      lapses: 0,
      due: NOW + 30 * DAY,
    };
    state.cards["verb:ckb:خواردن:past:1sg"] = { ease: 2.5, interval: 1, reps: 1, lapses: 0, due: NOW };
    expect(progress(state, filter, NOW)).toMatchObject({
      due: 1,
      seen: 3,
      mature: 1,
      today: { right: 1, wrong: 0 },
    });
  });

  it("counts a streak of days up to today, or yesterday", () => {
    let state = emptyPractice();
    for (const days of [3, 2, 1]) state = answer(state, "verb:kmr:dîtin:past:2sg", true, NOW - days * DAY);
    expect(progress(state, filter, NOW).streak).toBe(3);
    state = answer(state, "verb:kmr:dîtin:past:2sg", true, NOW);
    expect(progress(state, filter, NOW).streak).toBe(4);
    expect(progress(state, filter, NOW + 3 * DAY).streak).toBe(0);
  });

  it("keeps 90 days of results", () => {
    let state = emptyPractice();
    for (let day = 0; day < 100; day += 1)
      state = answer(state, "verb:kmr:dîtin:past:2sg", true, NOW + day * DAY);
    expect(Object.keys(state.days)).toHaveLength(90);
    expect(state.days[dateOf(NOW)]).toBeUndefined();
  });
});
