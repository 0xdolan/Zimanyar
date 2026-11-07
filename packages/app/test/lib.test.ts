import { answer, parsePractice, recordMistake } from "@zimanyar/practice";
import { describe, expect, it } from "vitest";
import { updatePractice } from "../src/practice-store";
import { lessonRoute, routeOfLessonLink } from "../src/routes";
import { pronounce, transliterate } from "../src/writing";

describe("routes", () => {
  it("makes routes for lessons", () => {
    expect(lessonRoute("ckb", 7, "the-bare-noun")).toBe("/learn/ckb/7/the-bare-noun");
    expect(lessonRoute("kmr", 14, "")).toBe("/learn/kmr/14");
  });
});

describe("links inside a lesson", () => {
  it("stay in the reader, keeping anchors", () => {
    expect(routeOfLessonLink("../14-past/#why", "kmr", 7)).toBe("/learn/kmr/14/why");
    expect(routeOfLessonLink("../../sorani/07-nouns/", "kmr", 7)).toBe("/learn/ckb/7");
  });

  it("go nowhere for pages the reader does not have", () => {
    expect(routeOfLessonLink("../../../rules/any.repeat.word/", "ckb", 7)).toBeNull();
    expect(routeOfLessonLink("../verbs/xwarin/", "kmr", 7)).toBeNull();
  });
});

describe("the other script and pronunciation", () => {
  it("takes Sorani to Latin, with its punctuation", () => {
    expect(transliterate("پیاوەکە هات؟")).toBe("pyaweke hat?");
  });

  it("takes Kurmanji to Arabic script", () => {
    expect(transliterate("Ez hatim")).toMatch(/\p{Script=Arabic}/u);
  });

  it("keeps what is between the words", () => {
    expect(transliterate("پیاو  (ژن)")).toBe("pyaw  (jin)");
  });

  it("gives the pronunciation in either script", () => {
    expect(pronounce("پیاو")).toBe("/pjaːw/");
    expect(pronounce("av")).toMatch(/^\/.+\/$/);
  });
});

describe("practice updates", () => {
  it("run one at a time from storage, so that none is lost", async () => {
    let stored: unknown;
    const storage = {
      load: async () => structuredClone(stored),
      save: async (state: unknown) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        stored = state;
      },
    };
    await Promise.all([
      updatePractice(storage, (state) => recordMistake(state, "kmr.ergative.agreement", "applied", 1)),
      updatePractice(storage, (state) => answer(state, "spot:kmr.ergative.agreement:0", true, 2)),
      updatePractice(storage, (state) => recordMistake(state, "kmr.ergative.agreement", "ignored", 3)),
    ]);
    const state = parsePractice(stored);
    expect(state.mistakes.map(({ action }) => action)).toEqual(["applied", "ignored"]);
    expect(Object.keys(state.cards)).toEqual(["spot:kmr.ergative.agreement:0"]);
  });

  it("keep going after a failed write", async () => {
    let fail = true;
    const storage = {
      load: async () => undefined,
      save: async () => {
        if (fail) {
          fail = false;
          throw new Error("full");
        }
      },
    };
    await expect(updatePractice(storage, (state) => state)).rejects.toThrow("full");
    await expect(updatePractice(storage, (state) => state)).resolves.toMatchObject({ version: 1 });
  });
});
