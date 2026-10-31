import { describe, expect, it } from "vitest";
import {
  blocksOf,
  componentFor,
  convertBody,
  escapeForMdx,
  renderPage,
  rewriteLinks,
  targetOf,
  withoutDashes,
} from "../content/import-zimankit-tutorials.js";

const EM = String.fromCodePoint(0x2014);
const EN = String.fromCodePoint(0x2013);

describe("withoutDashes", () => {
  it("turns a number range into words", () => {
    expect(withoutDashes(`Lessons 1${EN}10`)).toBe("Lessons 1 to 10");
  });

  it("uses a comma in prose and a dot in tables", () => {
    expect(withoutDashes(`Sorani ${EM} a variety ${EM} is`)).toBe("Sorani, a variety, is");
    expect(withoutDashes(`| a ${EM} b |`)).toBe("| a · b |");
  });

  it("leaves no dash behind, even alone", () => {
    expect(withoutDashes(`| ${EM} |\n${EM}`)).not.toMatch(new RegExp(`[${EM}${EN}]`));
  });
});

describe("blocksOf", () => {
  it("reads a block's arguments, lines and output", () => {
    const [block] = blocksOf(
      "<!-- gen:sentences ipa=1\nEz hatim. | I came.\n\nTu hatî.\n-->\n| table |\n<!-- /gen -->",
    );
    expect(block?.name).toBe("sentences");
    expect(block?.args).toEqual({ ipa: "1" });
    expect(block?.lines).toEqual([
      ["Ez hatim.", "I came."],
      ["Tu hatî.", ""],
    ]);
    expect(block?.output).toBe("| table |");
  });

  it("reads a block of one line", () => {
    const [block] = blocksOf("<!-- gen:verb verb=kirin cells=past -->\nx\n<!-- /gen -->");
    expect(block?.args).toEqual({ verb: "kirin", cells: "past" });
    expect(block?.lines).toEqual([]);
  });
});

describe("componentFor", () => {
  const block = (name: string, args = {}, lines: [string, string][] = []) => ({
    name,
    args,
    lines,
    output: "",
  });

  it.each([
    ["verb", { verb: "kirin", cells: "past" }, '<VerbTable lang="kmr" verb="kirin" cells="past" />'],
    ["noun", { nouns: "mal" }, '<NounTable lang="kmr" nouns="mal" />'],
    ["noun_persons", { noun: "mal" }, '<NounPersons lang="kmr" noun="mal" />'],
    ["words", { words: "mal" }, '<Words lang="kmr" words="mal" />'],
    ["analyze", { words: "mal" }, '<Analyze lang="kmr" words="mal" />'],
    ["alphabet", {}, '<Alphabet lang="kmr" />'],
    ["verb_index", {}, '<VerbIndex lang="kmr" />'],
    ["lessons", {}, ""],
  ])("%s", (name, args, expected) => {
    expect(componentFor(block(name, args), "kmr")).toBe(expected);
  });

  it("passes lines as data, with an option for IPA", () => {
    const lines: [string, string][] = [["Ez hatim.", "I came."]];
    expect(componentFor(block("sentences", { ipa: "1" }, lines), "kmr")).toBe(
      '<Sentences lang="kmr" ipa items={[["Ez hatim.","I came."]]} />',
    );
    expect(componentFor(block("sentences", {}, lines), "kmr")).not.toContain("ipa");
    expect(componentFor(block("ergativity", {}, lines), "kmr")).toContain("<Ergativity items=");
    expect(componentFor(block("normalize", {}, lines), "kmr")).toContain('<Normalize lang="kmr"');
  });

  it("refuses a block it does not know", () => {
    expect(() => componentFor(block("nope"), "kmr")).toThrow("unknown block nope");
  });
});

describe("escapeForMdx", () => {
  it("keeps braces and stray brackets from being read as code", () => {
    expect(escapeForMdx("a {b} 1 < 2")).toBe("a &#123;b&#125; 1 &lt; 2");
  });

  it("leaves code alone", () => {
    expect(escapeForMdx("`{x} < y`")).toBe("`{x} < y`");
    expect(escapeForMdx("```\n{x}\n```")).toBe("```\n{x}\n```");
  });

  it("closes line breaks, and puts answers on lines of their own", () => {
    expect(escapeForMdx("a<br>b")).toBe("a<br />b");
    expect(escapeForMdx("<details><summary>Answers</summary>\n\n1. x\n\n</details>")).toBe(
      "<details>\n<summary>Answers</summary>\n\n1. x\n\n</details>",
    );
  });
});

describe("links", () => {
  it("maps a file to its place on the site", () => {
    expect(targetOf("README.md")).toBe("");
    expect(targetOf("1-beginner/07-nouns.md")).toBe("07-nouns/");
    expect(targetOf("reference/verbs/README.md")).toBe("verbs/");
    expect(targetOf("reference/verbs/xwarin.md")).toBe("verbs/xwarin/");
    expect(targetOf("reference/nouns.md")).toBe("nouns/");
  });

  it("rewrites links between lessons, keeping anchors", () => {
    expect(rewriteLinks("[a](../2-intermediate/14-x.md#why)", "1-beginner/07-nouns.md", "ckb")).toBe(
      "[a](../14-x/#why)",
    );
  });

  it("rewrites links from the course page and from verb pages", () => {
    expect(rewriteLinks("[a](1-beginner/01-a.md)", "README.md", "kmr")).toBe("[a](01-a/)");
    expect(rewriteLinks("[a](../../README.md)", "reference/verbs/README.md", "kmr")).toBe("[a](../)");
  });

  it("uses the other course's address in a link between courses", () => {
    expect(rewriteLinks("[a](../kmr/README.md)", "README.md", "ckb")).toBe("[a](../kurmanji/)");
  });

  it("leaves other links alone", () => {
    expect(rewriteLinks("[a](https://example.org/x)", "README.md", "ckb")).toBe("[a](https://example.org/x)");
  });
});

describe("a page", () => {
  it("imports only the components it uses, from the right depth", () => {
    const body = "<VerbTable /> and <Words /> and <VerbTable />";
    expect(renderPage({ frontmatter: ["title: x"], body })).toContain(
      'import { VerbTable, Words } from "../../src/components.tsx";',
    );
    expect(renderPage({ frontmatter: ["title: x"], body }, 1)).toContain(
      'from "../../../src/components.tsx"',
    );
  });

  it("has no import when it uses no component", () => {
    expect(renderPage({ frontmatter: ["title: x"], body: "plain" })).not.toContain("import");
  });

  it("loses its navigation and title, and gets components for blocks", () => {
    const source = [
      "<!-- nav:top -->",
      "[back](x.md)",
      "<!-- nav:top -->",
      "",
      "# 1. A lesson",
      "",
      "**Level:** beginner",
      "",
      "Text {here}.",
      "",
      "<!-- gen:verb verb=kirin cells=past -->",
      "| generated {table} |",
      "<!-- /gen -->",
      "",
      "<!-- nav:bottom -->",
      "bar",
      "<!-- nav:bottom -->",
    ].join("\n");
    const body = convertBody(source, "1-beginner/01-a.md", "kmr");
    expect(body).not.toContain("nav:");
    expect(body).not.toContain("# 1. A lesson");
    expect(body).not.toContain("Level");
    expect(body).toContain("Text &#123;here&#125;.");
    expect(body).toContain('<VerbTable lang="kmr" verb="kirin" cells="past" />');
    expect(body).not.toContain("generated");
  });
});
