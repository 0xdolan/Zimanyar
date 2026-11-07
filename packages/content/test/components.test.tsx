import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Checker } from "@zimanyar/checker";
import { renderToStaticMarkup as html } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Alphabet,
  Analyze,
  Ergativity,
  LessonRules,
  Normalize,
  NounForms,
  NounPersons,
  NounTable,
  rulesOfLesson,
  Sentences,
  VerbIndex,
  VerbInfo,
  VerbOtherForms,
  VerbTable,
  Vocabulary,
  Words,
} from "../src/components.js";
import { rehypeKurdish, splitText } from "../src/rehype-kurdish.js";

const FORBIDDEN = new RegExp(`[${String.fromCodePoint(0x2014, 0x2013)}]`);

describe("tables", () => {
  it("give Kurdish its language and direction", () => {
    const table = html(<VerbTable cells="present" lang="ckb" verb="خواردن" />);
    expect(table).toContain('<span dir="rtl" lang="ckb">دەخۆم</span>');
    expect(table).toContain('<span dir="ltr" lang="ckb-Latn">dexom</span>');
  });

  it("give the Arabic-script spelling of Kurmanji its own language and direction", () => {
    const table = html(<VerbTable cells="present" lang="kmr" verb="kirin" />);
    expect(table).toContain('dir="ltr" lang="kmr"');
    expect(table).toContain('dir="rtl" lang="kmr-Arab"');
  });

  it("add agent and object columns for Kurmanji's ergative tenses, and explain them", () => {
    const table = html(<VerbTable cells="past" lang="kmr" verb="dîtin" />);
    expect(table).toContain("agent (oblique)");
    expect(table).toContain("object (direct)");
    expect(table).toContain("<strong>ergative</strong>");
  });

  it("explain Sorani's ergative tenses their own way", () => {
    expect(html(<VerbTable cells="past" lang="ckb" verb="کردن" />)).toContain("set-2 clitic");
  });

  it("do not call an intransitive past ergative", () => {
    const table = html(<VerbTable cells="past" lang="ckb" verb="هاتن" />);
    expect(table).not.toContain("ergative");
    expect(table).toContain("intransitive");
  });

  it("can leave out the caption, and name a preverb", () => {
    expect(html(<VerbTable cells="present" lang="kmr" noCaption verb="kirin" />)).not.toContain(
      "present stem",
    );
    expect(html(<VerbTable cells="present" lang="kmr" verb="hilgirtin" />)).toContain("preverb");
  });

  it("show IPA when asked", () => {
    expect(html(<VerbTable cells="present" lang="kmr" show="translit,ipa" verb="kirin" />)).toContain(
      'class="zy-ipa"',
    );
  });

  it("show a form that does not exist as a dot, not as a dash", () => {
    const table = html(<NounTable cells="bare,pl" lang="ckb" nouns="خانە" />);
    expect(table).toContain('class="zy-empty"');
    expect(table).not.toMatch(FORBIDDEN);
  });

  it("show a noun's gender in Kurmanji only", () => {
    expect(html(<NounTable lang="kmr" nouns="mal" />)).toContain("gender");
    expect(html(<NounTable lang="ckb" nouns="پیاو" />)).not.toContain("gender");
  });

  it("render every other kind", () => {
    const all = [
      <VerbInfo key="1" lang="ckb" verb="هەڵگرتن" />,
      <VerbInfo key="2" lang="kmr" verb="dîtin" />,
      <VerbOtherForms key="3" lang="ckb" verb="خواردن" />,
      <NounPersons key="4" lang="ckb" noun="کتێب" />,
      <NounForms key="5" lang="kmr" noun="mal" />,
      <Words key="6" lang="ckb" words="ژن,دوور" />,
      <Sentences ipa items={[["Ez hatim.", "I came."]]} key="7" lang="kmr" />,
      <Sentences items={[["من هاتم.", "I came."]]} key="8" lang="ckb" />,
      <Analyze key="9" lang="ckb" words="پیاوەکە" />,
      <Analyze key="10" lang="kmr" words="mal" />,
      <Ergativity
        items={[
          ["Min tu dîtî.", "I saw you."],
          ["Min tu dîtim.", "wrong"],
          ["Baş e.", "Fine."],
        ]}
        key="11"
      />,
      <Normalize
        items={[
          ["کتاب", "a note"],
          ["ك", ""],
        ]}
        key="12"
        lang="ckb"
      />,
      <Normalize items={[["dıçım", ""]]} key="13" lang="kmr" />,
      <Alphabet key="14" lang="ckb" />,
      <Alphabet key="15" lang="kmr" />,
      <VerbIndex key="16" lang="ckb" />,
      <VerbIndex key="17" lang="kmr" />,
      <Vocabulary key="18" lang="ckb" />,
      <Vocabulary key="19" lang="kmr" />,
    ];
    for (const element of all) {
      const rendered = html(element);
      expect(rendered.length).toBeGreaterThan(50);
      expect(rendered).not.toMatch(FORBIDDEN);
    }
  });

  it("link a lesson to the rules it teaches", () => {
    const rules = rulesOfLesson("ckb", 7);
    expect(rules).toContain("ckb.morph.definite-allomorph");
    expect(html(<LessonRules lang="ckb" lesson={7} />)).toContain(
      'href="../../../rules/ckb.morph.definite-allomorph/"',
    );
  });
});

describe("Arabic script in English prose", () => {
  const texts = (nodes: ReturnType<typeof splitText>) =>
    nodes.map((node) => (node.type === "text" ? node.value : `[${node.children?.[0]?.value}]`)).join("");

  it("is wrapped, a whole phrase at a time", () => {
    expect(texts(splitText("Say من هاتم to mean I came."))).toBe("Say [من هاتم] to mean I came.");
  });

  it("keeps its own punctuation, and leaves Latin letters out", () => {
    expect(texts(splitText("Is it چۆنی؟ or not"))).toBe("Is it [چۆنی؟] or not");
    expect(texts(splitText("پیاو is a noun, ژن too."))).toBe("[پیاو] is a noun, [ژن] too.");
  });

  it("leaves text without it alone", () => {
    expect(splitText("plain")).toEqual([{ type: "text", value: "plain" }]);
    expect(splitText("")).toEqual([]);
  });

  it("marks language and direction, and skips code and headings", () => {
    const tree = {
      type: "root",
      children: [
        { type: "element", tagName: "p", children: [{ type: "text", value: "a من" }] },
        { type: "element", tagName: "code", children: [{ type: "text", value: "من" }] },
        { type: "element", tagName: "h2", children: [{ type: "text", value: "من" }] },
        { type: "comment" },
      ],
    };
    rehypeKurdish()(tree);
    const [p, code, heading] = tree.children as { children: { tagName?: string; properties?: unknown }[] }[];
    expect(p?.children[1]).toMatchObject({ tagName: "span", properties: { lang: "ckb", dir: "rtl" } });
    expect(code?.children[0]?.tagName).toBeUndefined();
    expect(heading?.children[0]?.tagName).toBeUndefined();
  });
});

describe("the lessons", () => {
  const root = new URL("../lessons/", import.meta.url).pathname;
  const files = ["ckb", "kmr"].flatMap((lang) =>
    readdirSync(join(root, lang))
      .filter((file) => /^\d\d-/.test(file))
      .map((file) => [`${lang}/${file}`, lang] as const),
  );

  it("number 23 for each course", () => {
    expect(files).toHaveLength(46);
  });

  it.each(files)("%s has sentences the checker accepts", (file, lang) => {
    const text = readFileSync(join(root, file), "utf8");
    const checker = new Checker();
    for (const match of text.matchAll(/<Sentences [^\n]*items=\{(\[.*\])\} \/>/g)) {
      for (const [kurdish] of JSON.parse(match[1] as string) as [string, string][]) {
        const errors = checker
          .check(kurdish, { lang: lang as "ckb" | "kmr" })
          .filter((finding) => finding.severity === "error")
          .map((finding) => finding.ruleId);
        expect([kurdish, errors]).toEqual([kurdish, []]);
      }
    }
  });
});
