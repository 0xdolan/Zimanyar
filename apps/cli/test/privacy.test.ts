import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cli } from "./helpers.js";

describe("privacy", () => {
  const attempts: string[] = [];
  const refuse = (what: string) => () => {
    attempts.push(what);
    throw new Error(`network: ${what}`);
  };

  beforeAll(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(refuse("fetch"));
    vi.spyOn(net.Socket.prototype, "connect").mockImplementation(refuse("socket"));
    vi.spyOn(dns, "lookup").mockImplementation(refuse("dns"));
    vi.spyOn(http, "request").mockImplementation(refuse("http"));
    vi.spyOn(https, "request").mockImplementation(refuse("https"));
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("no command opens a connection", async () => {
    const runs = [
      ["check", "--format", "sarif", "a.md"],
      ["check", "--fix", "a.md"],
      ["analyze", "پیاوەکان"],
      ["conjugate", "dîtin"],
      ["decline", "kitêb"],
      ["ipa", "Ez"],
      ["translit", "Ez"],
      ["normalize", "كوردستان"],
      ["lid", "Ez diçim malê"],
      ["explain", "kmr.ergative.agreement"],
      ["lesson", "14", "--lang", "kmr"],
    ];
    for (const argv of runs) {
      await cli(argv, { files: { "a.md": "Min tu dîtim. كوردستان" } });
    }
    expect(attempts).toEqual([]);
  });
});
