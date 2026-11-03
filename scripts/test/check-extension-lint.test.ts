import { describe, expect, it } from "vitest";
import { findProblems } from "../checks/check-extension-lint.js";

const react = { code: "UNSAFE_VAR_ASSIGNMENT", file: "chunks/a.js", message: "innerHTML" };
const holdsReact = (file: string) => file === "chunks/a.js";

describe("check-extension-lint", () => {
  it("passes a clean report", () => {
    expect(findProblems({ errors: [], warnings: [] }, holdsReact)).toEqual([]);
  });

  it("allows react-dom's own assignments, wherever they are bundled", () => {
    expect(findProblems({ errors: [], warnings: [react, react] }, holdsReact)).toEqual([]);
  });

  it("notices one more than react-dom's", () => {
    expect(findProblems({ errors: [], warnings: [react, react, react] }, holdsReact)[0]).toContain("3 times");
  });

  it("fails on an assignment in a file without React", () => {
    expect(
      findProblems({ errors: [], warnings: [{ ...react, file: "background.js" }] }, holdsReact),
    ).toHaveLength(1);
  });

  it("fails on any error and any other warning", () => {
    const other = { code: "DANGEROUS_EVAL", file: "chunks/a.js", message: "eval" };
    expect(findProblems({ errors: [other], warnings: [] }, holdsReact)).toHaveLength(1);
    expect(findProblems({ errors: [], warnings: [other] }, holdsReact)).toHaveLength(1);
    expect(findProblems({ errors: [], warnings: [{ code: "X", message: "m" }] }, holdsReact)).toHaveLength(1);
  });
});
