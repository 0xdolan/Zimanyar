import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createT, type UiLang } from "@zimanyar/i18n";
import { type Finding, ruleMeta } from "@zimanyar/rules";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutocompleteList, BidiText, FindingCard, FindingsPanel, optionId } from "../src/index.js";
import { splitBidi } from "../src/lib/bidi.js";

afterEach(cleanup);

function findingOf(ruleId: string, overrides: Partial<Finding> = {}): Finding {
  const meta = ruleMeta(ruleId);
  return {
    id: `${ruleId}-1`,
    ruleId,
    lang: meta.lang,
    category: meta.category,
    severity: meta.severity,
    range: { start: 0, end: 5 },
    message: { key: `rule.${ruleId}.message`, params: { object: "tu", word: "ez" } },
    reason: { key: `rule.${ruleId}.reason`, params: { object: "tu", word: "ez" } },
    suggestions: [{ text: "dîtî" }, { text: "dîtin" }],
    examples: meta.examples,
    lessons: meta.lessons,
    confidence: 0.9,
    safeFix: false,
    ...overrides,
  };
}
const ergative = findingOf("kmr.ergative.agreement");
const spelling = findingOf("kmr.spell.unknown", { suggestions: [] });
const sorani = findingOf("ckb.morph.definite-allomorph", { suggestions: [{ text: "دەرگاکە" }] });

/** axe in jsdom cannot see colours or layout: Playwright covers those in a real browser. */
async function expectAccessible(container: Element) {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
}

describe("FindingCard", () => {
  it("says what is wrong and offers the fix", () => {
    render(<FindingCard finding={ergative} lang="en" />);
    expect(screen.getByRole("region").textContent).toContain("agrees with the object");
    expect(screen.getByRole("button", { name: "Replace with dîtî" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Replace with dîtin" })).toBeTruthy();
  });

  it("never uses colour alone: the severity and category are in words", () => {
    render(<FindingCard finding={ergative} lang="en" />);
    expect(screen.getByText("Error")).toBeTruthy();
    expect(screen.getByText("Agreement")).toBeTruthy();
  });

  it("applies a suggestion, ignores and closes", () => {
    const onApply = vi.fn();
    const onIgnore = vi.fn();
    const onClose = vi.fn();
    render(
      <FindingCard finding={ergative} lang="en" onApply={onApply} onClose={onClose} onIgnore={onIgnore} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Replace with dîtin" }));
    expect(onApply).toHaveBeenCalledWith("dîtin");
    fireEvent.click(screen.getByRole("button", { name: "Ignore" }));
    expect(onIgnore).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("works with no handlers", () => {
    render(<FindingCard finding={ergative} lang="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Replace with dîtî" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Lesson/ })[0] as HTMLElement);
  });

  it("closes on Esc, and only then", () => {
    const onClose = vi.fn();
    render(<FindingCard finding={ergative} lang="en" onClose={onClose} />);
    const button = screen.getByRole("button", { name: "Replace with dîtî" });
    fireEvent.keyDown(button, { key: "a" });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(button, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ignores Esc with nothing to close", () => {
    render(<FindingCard finding={ergative} lang="en" />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Replace with dîtî" }), { key: "Escape" });
  });

  it("takes focus when asked, for a card opened from the page", () => {
    render(<FindingCard autoFocus finding={ergative} lang="en" />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Replace with dîtî" }));
  });

  it("teaches when expanded: the reason, examples, lessons, confidence and rule", () => {
    const onLearn = vi.fn();
    render(<FindingCard finding={ergative} lang="en" onLearn={onLearn} />);
    expect(screen.getByRole("region").textContent).toContain("ergative");
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("Confidence 90%")).toBeTruthy();
    expect(screen.getByText("Rule kmr.ergative.agreement")).toBeTruthy();
    const lesson = screen.getAllByRole("button", { name: /Lesson 14/ })[0] as HTMLElement;
    fireEvent.click(lesson);
    expect(onLearn).toHaveBeenCalledWith(expect.objectContaining({ lessonId: 14, lang: "kmr" }));
  });

  it("names a lesson by number where its title is not translated", () => {
    render(<FindingCard finding={ergative} lang="ckb" />);
    expect(screen.getByRole("button", { name: /وانەی ١٤/ }).textContent).not.toMatch(/[a-z]/);
  });

  it("does not strike through wrong examples, which would cut through Kurdish letter marks", () => {
    const { container } = render(<FindingCard finding={sorani} lang="en" />);
    expect(container.querySelector(".line-through")).toBeNull();
  });

  it("stays short when compact, with one link to learn more", () => {
    const onLearn = vi.fn();
    render(<FindingCard finding={ergative} lang="en" onLearn={onLearn} variant="compact" />);
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Learn" }));
    expect(onLearn).toHaveBeenCalledWith(ergative.lessons[0]);
  });

  it("can teach when compact, as teaching mode asks", () => {
    render(<FindingCard finding={ergative} lang="en" teaching variant="compact" />);
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("says so when there is nothing to suggest", () => {
    render(<FindingCard finding={spelling} lang="en" />);
    expect(screen.getByText("No suggestion. Check this one by hand.")).toBeTruthy();
  });

  it("offers the dictionary only for spelling", () => {
    const onAdd = vi.fn();
    const { unmount } = render(<FindingCard finding={spelling} lang="en" onAddToDictionary={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "Add to dictionary" }));
    expect(onAdd).toHaveBeenCalledOnce();
    unmount();
    render(<FindingCard finding={ergative} lang="en" onAddToDictionary={onAdd} />);
    expect(screen.queryByRole("button", { name: "Add to dictionary" })).toBeNull();
  });

  it("omits examples and lessons a finding lacks", () => {
    render(<FindingCard finding={{ ...ergative, examples: [], lessons: [] }} lang="en" variant="compact" />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: "Learn" })).toBeNull();
  });

  it("shows pronunciation on request", () => {
    render(
      <FindingCard finding={ergative} ipaOf={(word) => (word === "dîtî" ? "diːtiː" : null)} lang="en" />,
    );
    expect(screen.queryByText(/diːtiː/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show pronunciation" }));
    expect(screen.getByText("Pronunciation: diːtiː")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide pronunciation" }));
    expect(screen.queryByText(/diːtiː/)).toBeNull();
  });

  it("offers no pronunciation when there is none", () => {
    render(<FindingCard finding={ergative} ipaOf={() => null} lang="en" />);
    expect(screen.queryByRole("button", { name: "Show pronunciation" })).toBeNull();
  });

  it("renders a message as text, never as markup", () => {
    const hostile = findingOf("any.repeat.word", {
      message: { key: "rule.any.repeat.word.message", params: { word: "<img src=x onerror=alert(1)>" } },
      suggestions: [{ text: "<b>x</b>" }],
    });
    const { container } = render(<FindingCard finding={hostile} lang="en" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it.each<[UiLang, string]>([
    ["en", "ltr"],
    ["kmr", "ltr"],
    ["ckb", "rtl"],
  ])("sets the direction of %s", (lang, dir) => {
    const { container } = render(<FindingCard finding={sorani} lang={lang} />);
    expect(container.querySelector("section")?.getAttribute("dir")).toBe(dir);
    expect(container.querySelector("section")?.getAttribute("lang")).toBe(lang);
  });

  it.each<UiLang>(["en", "ckb", "kmr"])("is accessible in %s", async (lang) => {
    const { container } = render(
      <FindingCard
        finding={ergative}
        ipaOf={() => "x"}
        lang={lang}
        onAddToDictionary={() => {}}
        onClose={() => {}}
        onIgnore={() => {}}
      />,
    );
    await expectAccessible(container);
  });

  it("has every string in three languages", () => {
    for (const lang of ["ckb", "kmr"] as const) {
      const { container, unmount } = render(
        <FindingCard finding={ergative} lang={lang} onIgnore={() => {}} />,
      );
      expect(container.textContent).toContain(createT(lang)("finding.ignore"));
      expect(container.textContent).not.toContain("Ignore");
      unmount();
    }
  });
});

describe("FindingsPanel", () => {
  it("groups by category in family order, with counts", () => {
    render(
      <FindingsPanel
        findings={[ergative, findingOf("any.repeat.word"), spelling]}
        lang="en"
        textOf={() => "word"}
      />,
    );
    expect(screen.getByText("3 findings")).toBeTruthy();
    const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(headings).toEqual(["Spelling1 finding", "Agreement1 finding", "Style1 finding"]);
  });

  it("says when there is nothing", () => {
    render(<FindingsPanel findings={[]} lang="en" />);
    expect(screen.getByText("No findings")).toBeTruthy();
  });

  it("selects a finding and marks the current one", () => {
    const onSelect = vi.fn();
    render(
      <FindingsPanel
        findings={[ergative, spelling]}
        lang="en"
        onSelect={onSelect}
        selectedId={ergative.id}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.filter((button) => button.getAttribute("aria-current") === "true")).toHaveLength(1);
    fireEvent.click(buttons[0] as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith(spelling);
  });

  it("works with no handler", () => {
    render(<FindingsPanel findings={[spelling]} lang="en" />);
    fireEvent.click(screen.getByRole("button"));
  });

  it("is accessible, and right to left in Sorani", async () => {
    const { container } = render(<FindingsPanel findings={[sorani]} lang="ckb" />);
    expect(container.querySelector('[dir="rtl"]')).toBeTruthy();
    await expectAccessible(container);
  });
});

describe("AutocompleteList", () => {
  const items = [
    { word: "kitêb", attested: true },
    { word: "kitêbên", attested: false },
  ];

  it("lists words as options and marks the active one", () => {
    render(<AutocompleteList activeIndex={1} id="list" items={items} lang="en" onSelect={() => {}} />);
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.getAttribute("aria-selected"))).toEqual(["false", "true"]);
    expect(options[1]?.id).toBe(optionId("list", 1));
  });

  it("marks a form never seen in the corpus, in words as well", () => {
    render(<AutocompleteList activeIndex={0} id="list" items={items} lang="en" onSelect={() => {}} />);
    expect(screen.getByText("Generated form, not seen in the corpus")).toBeTruthy();
  });

  it("selects by mouse without taking focus from the text", () => {
    const onSelect = vi.fn();
    render(<AutocompleteList activeIndex={0} id="list" items={items} lang="en" onSelect={onSelect} />);
    const option = screen.getAllByRole("option")[0] as HTMLElement;
    expect(fireEvent.mouseDown(option)).toBe(false);
    fireEvent.click(option);
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });

  it("is accessible", async () => {
    const { container } = render(
      <AutocompleteList activeIndex={0} id="list" items={items} lang="kmr" onSelect={() => {}} />,
    );
    await expectAccessible(container);
  });
});

describe("mixed scripts", () => {
  it("isolates each script with its own direction", () => {
    expect(splitBidi("Write دەرگاکە here")).toEqual([
      { text: "Write", dir: "ltr" },
      { text: " ", dir: null },
      { text: "دەرگاکە", dir: "rtl" },
      { text: " ", dir: null },
      { text: "here", dir: "ltr" },
    ]);
  });

  it("keeps the words of one script together", () => {
    expect(splitBidi("من نان خوارد")).toEqual([{ text: "من نان خوارد", dir: "rtl" }]);
    expect(splitBidi("Min tu dîtî.")).toEqual([
      { text: "Min tu dîtî", dir: "ltr" },
      { text: ".", dir: null },
    ]);
  });

  it("handles text with no letters, and no text", () => {
    expect(splitBidi("123")).toEqual([{ text: "123", dir: null }]);
    expect(splitBidi("")).toEqual([]);
    expect(splitBidi("12 ab")).toEqual([
      { text: "12 ", dir: null },
      { text: "ab", dir: "ltr" },
    ]);
    expect(splitBidi("ab 1 cd")).toEqual([{ text: "ab 1 cd", dir: "ltr" }]);
  });

  it("renders text nodes with direction and language", () => {
    const { container } = render(<BidiText text="a دا" />);
    const parts = container.querySelectorAll("bdi");
    expect(parts[0]?.getAttribute("dir")).toBe("ltr");
    expect(parts[1]?.getAttribute("dir")).toBe("rtl");
    expect(parts[1]?.getAttribute("lang")).toBe("ckb");
  });
});
