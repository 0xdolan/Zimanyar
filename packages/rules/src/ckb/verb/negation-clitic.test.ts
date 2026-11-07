import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { negationClitic } from "./negation-clitic.js";

describe("ckb.verb.negation-clitic", () => {
  ruleCases({
    rule: negationClitic,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["نەخواردم", "نەمخوارد"],
      ["نەخواردت", "نەتخوارد"],
      ["نەخواردی", "نەیخوارد"],
      ["نەخواردمان", "نەمانخوارد"],
      ["نەخواردتان", "نەتانخوارد"],
      ["نەخواردیان", "نەیانخوارد"],
      ["نەکڕیم", "نەمکڕی"],
      ["نەکڕیمان", "نەمانکڕی"],
      ["نەبردم", "نەمبرد"],
      ["من نەخواردم", "نەمخوارد"],
    ],
    negative: [
      "نەمخوارد",
      "نەتخوارد",
      "نەیخوارد",
      "نەمانخوارد",
      "نەهاتم",
      "نەهاتین",
      "خواردم",
      "نەخوارد",
      "نەمکڕی",
      "نەخێر",
      "kitêb",
      "",
    ],
  });
});
