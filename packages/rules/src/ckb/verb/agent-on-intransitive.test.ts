import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { agentOnIntransitive } from "./agent-on-intransitive.js";

describe("ckb.verb.agent-on-intransitive", () => {
  ruleCases({
    rule: agentOnIntransitive,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["هاتمان", "هاتین"],
      ["هاتتان", "هاتن"],
      ["هاتیان", "هاتن"],
      ["چوومان", "چووین"],
      ["چوویان", "چوون"],
      ["نەهاتمان", "نەهاتین"],
      ["دەهاتمان", "دەهاتین"],
      ["مردمان", "مردین"],
      ["ئێمە هاتمان", "هاتین"],
      ["کەوتمان", "کەوتین"],
    ],
    negative: [
      "هاتین",
      "هاتن",
      "چووین",
      "چوون",
      "نەهاتین",
      "خواردمان",
      "کڕیمان",
      "نانمان",
      "پارەمان",
      "هاتم",
      "kitêb",
      "",
    ],
  });
});
