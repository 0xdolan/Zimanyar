import { describe, expect, it } from "vitest";
import { baseName, chooseDropped, isTextFileName, MAX_FILE_BYTES } from "../src/lib/text-files";

const file = (name: string, size = 10) => ({ name, size });

describe("text files", () => {
  it("knows which it opens", () => {
    expect(isTextFileName("a.txt")).toBe(true);
    expect(isTextFileName("A.MD")).toBe(true);
    expect(isTextFileName("a.pdf")).toBe(false);
    expect(isTextFileName("noextension")).toBe(false);
  });

  it("takes the first file it can open from a drop", () => {
    const wanted = file("b.md");
    expect(chooseDropped([file("a.png"), wanted, file("c.txt")])).toEqual({ file: wanted });
  });

  it("says why it cannot open what was dropped", () => {
    expect(chooseDropped([file("a.png")])).toEqual({ problem: "kind" });
    expect(chooseDropped([file("a.txt", MAX_FILE_BYTES + 1)])).toEqual({ problem: "size" });
    expect(chooseDropped([])).toBeNull();
  });

  it("names a file from its path", () => {
    expect(baseName("/home/x/notes.md")).toBe("notes.md");
    expect(baseName("notes.md")).toBe("notes.md");
  });
});
