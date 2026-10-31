import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { definiteAdjectiveOrder } from "./definite-adjective-order.js";

describe("ckb.morph.definite-adjective-order", () => {
  ruleCases({
    rule: definiteAdjectiveOrder,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["پیاوەکە باش", "پیاوە باشەکە"],
      ["ژنەکە جوان", "ژنە جوانەکە"],
      ["پیاوەکان باش", "پیاوە باشەکان"],
      ["کتێبەکە باش", "کتێبە باشەکە"],
      ["نانەکە باش", "نانە باشەکە"],
      ["کچەکە جوان", "کچە جوانەکە"],
      ["کوڕەکە باش", "کوڕە باشەکە"],
      ["دەرگاکە جوان", "دەرگایە جوانەکە"],
      ["ماڵەکان جوان", "ماڵە جوانەکان"],
      ["من کتێبەکە باش", "کتێبە باشەکە"],
    ],
    negative: [
      "پیاوە باشەکە",
      "پیاوەکە باشە",
      "پیاوەکە هات",
      "پیاوەکە باش دەخوێنێت",
      "پیاو باش",
      "ژنە جوانەکە",
      "کتێبەکە",
      "پیاوەکە، باش",
      "باش پیاوەکە",
      "کە باش",
      "kitêb",
    ],
  });
});
