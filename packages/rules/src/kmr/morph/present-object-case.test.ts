import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { presentObjectCase } from "./present-object-case.js";

describe("kmr.morph.present-object-case", () => {
  ruleCases({
    rule: presentObjectCase,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["Ez pirtûk dixwînim", "pirtûkê"],
      ["Tu jin dibînî", "jinê"],
      ["Ew keç dibîne", "keçê"],
      ["Em mal dibînin", "malê"],
      ["Hûn pirtûk dixwînin", "pirtûkê"],
      ["ez pirtûk dibînim", "pirtûkê"],
      ["Ez jin dibînim", "jinê"],
      ["Tu pirtûk dixwînî", "pirtûkê"],
      ["Ez mal dibînim", "malê"],
      ["Ew pirtûk dixwîne", "pirtûkê"],
    ],
    negative: [
      "Ew kurdî nizane.",
      "Ez pirtûkê dixwînim",
      "Tu jinê dibînî",
      "Ez nan dixwim",
      "Ez gund dibînim",
      "Ez hatim",
      "Ez mal im",
      "Ez diçim mal",
      "Pirtûk dixwînim",
      "Ez, pirtûk dixwînim",
      "Ez pirtûk xwendim",
      "kurd",
      "",
    ],
  });
});
