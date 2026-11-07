import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { PassThrough } from "node:stream";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createConnection,
  createProtocolConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-languageserver/node";
import { localEngine } from "../src/lsp/engine.js";
import { serve } from "../src/lsp/server.js";
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

  it("the language server opens no connection", async () => {
    const toServer = new PassThrough();
    const toClient = new PassThrough();
    serve(
      createConnection(new StreamMessageReader(toServer), new StreamMessageWriter(toClient)),
      localEngine({}),
      { lang: "auto", ui: "en", rules: [], disable: [], tolerant: false, words: [] },
    );
    const client = createProtocolConnection(
      new StreamMessageReader(toClient),
      new StreamMessageWriter(toServer),
    );
    const diagnostics = new Promise((resolve) =>
      client.onNotification("textDocument/publishDiagnostics", resolve),
    );
    client.listen();
    await client.sendRequest("initialize", { processId: null, rootUri: null, capabilities: {} });
    await client.sendNotification("initialized", {});
    const uri = "file:///a.md";
    const textDocument = { uri, languageId: "markdown", version: 1, text: "Min tu dîtim. كوردستان" };
    await client.sendNotification("textDocument/didOpen", { textDocument });
    await diagnostics;
    const position = { line: 0, character: 5 };
    await client.sendRequest("textDocument/hover", { textDocument: { uri }, position });
    await client.sendRequest("textDocument/codeAction", {
      textDocument: { uri },
      range: { start: { line: 0, character: 0 }, end: position },
      context: { diagnostics: [] },
    });
    await client.sendRequest("textDocument/completion", {
      textDocument: { uri },
      position: { line: 0, character: 2 },
    });
    client.dispose();
    expect(attempts).toEqual([]);
  });
});
