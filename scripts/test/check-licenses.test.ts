import { afterEach, describe, expect, it, vi } from "vitest";
import { isAllowed, main } from "../checks/check-licenses.js";

describe("check-licenses", () => {
  it.each(["MIT", "Apache-2.0", "(MIT OR Apache-2.0)", "MIT AND ISC", "GPL-2.0 OR MIT"])(
    "allows %s",
    (id) => {
      expect(isAllowed(id)).toBe(true);
    },
  );

  it.each(["GPL-2.0-only", "SSPL-1.0", "MIT AND BUSL-1.1", "UNKNOWN", "CC-BY-NC-4.0"])("rejects %s", (id) => {
    expect(isAllowed(id)).toBe(false);
  });
});

describe("check-licenses main", () => {
  const quiet = () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    return vi.spyOn(console, "error").mockImplementation(() => {});
  };
  afterEach(() => vi.restoreAllMocks());

  it("passes when there are no production dependencies", () => {
    quiet();
    expect(main(() => "No licenses in packages found")).toBe(0);
  });

  it("passes with allowed licences", () => {
    quiet();
    expect(main(() => JSON.stringify({ MIT: [{ name: "a" }], "Apache-2.0": [{ name: "b" }] }))).toBe(0);
  });

  it("fails and names the packages with a rejected licence", () => {
    const error = quiet();
    expect(main(() => JSON.stringify({ MIT: [{ name: "a" }], "SSPL-1.0": [{ name: "db" }] }))).toBe(1);
    expect(error).toHaveBeenCalledWith("SSPL-1.0: db");
  });
});
