import { describe, expect, it } from "vitest";
import { findProblems } from "../checks/check-extension-lint.js";

const react = { code: "UNSAFE_VAR_ASSIGNMENT", file: "content-scripts/content.js", message: "innerHTML" };

describe("check-extension-lint", () => {
  it("passes a clean report", () => {
    expect(findProblems({ errors: [], warnings: [] })).toEqual([]);
  });

  it("allows react-dom's own assignments", () => {
    expect(findProblems({ errors: [], warnings: [react, react] })).toEqual([]);
    expect(
      findProblems({ errors: [], warnings: [{ ...react, file: "chunks/browser-page-AbC_1.js" }] }),
    ).toEqual([]);
  });

  it("notices one more than react-dom's", () => {
    expect(findProblems({ errors: [], warnings: [react, react, react] })[0]).toContain("3 times");
  });

  it("fails on an assignment anywhere else", () => {
    expect(findProblems({ errors: [], warnings: [{ ...react, file: "background.js" }] })).toHaveLength(1);
  });

  it("fails on any error and any other warning", () => {
    const other = { code: "DANGEROUS_EVAL", file: "background.js", message: "eval" };
    expect(findProblems({ errors: [other], warnings: [] })).toHaveLength(1);
    expect(findProblems({ errors: [], warnings: [other] })).toHaveLength(1);
    expect(findProblems({ errors: [], warnings: [{ code: "X", message: "m" }] })).toHaveLength(1);
  });
});
