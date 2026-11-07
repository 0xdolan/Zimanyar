import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { createT } from "@zimanyar/i18n";
import { afterEach, describe, expect, it } from "vitest";
import {
  type CodeAction,
  type CompletionItem,
  createConnection,
  createProtocolConnection,
  type Hover,
  type MarkupContent,
  type PublishDiagnosticsParams,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-languageserver/node";
import type { Located } from "../src/check.js";
import { run } from "../src/cli.js";
import type { Io } from "../src/io.js";
import { engineHandler, localEngine } from "../src/lsp/engine.js";
import { hoverOf, type Settings, serve, settingsOf } from "../src/lsp/server.js";
import { workerEngine } from "../src/lsp/worker.js";

const DEFAULTS: Settings = { lang: "auto", ui: "en", rules: [], disable: [], tolerant: false, words: [] };
const OPTIONS = { lang: "auto", markdown: false, fix: false } as const;
const lexiconPath = (lang: string) =>
  join(import.meta.dirname, `../../../packages/data/build/lexicon-${lang}.bin.gz`);

type Client = ReturnType<typeof createProtocolConnection>;
const clients: Client[] = [];

/** A server and a client joined by streams in memory, with the published diagnostics in order. */
async function start(initializationOptions?: unknown) {
  const toServer = new PassThrough();
  const toClient = new PassThrough();
  serve(
    createConnection(new StreamMessageReader(toServer), new StreamMessageWriter(toClient)),
    localEngine({}),
    DEFAULTS,
  );
  const client = createProtocolConnection(
    new StreamMessageReader(toClient),
    new StreamMessageWriter(toServer),
  );
  clients.push(client);
  const published: PublishDiagnosticsParams[] = [];
  const waiting: ((params: PublishDiagnosticsParams) => void)[] = [];
  client.onNotification("textDocument/publishDiagnostics", (params: PublishDiagnosticsParams) => {
    const next = waiting.shift();
    if (next) next(params);
    else published.push(params);
  });
  client.listen();
  const init = (await client.sendRequest("initialize", {
    processId: null,
    rootUri: null,
    capabilities: {},
    initializationOptions,
  })) as { capabilities: Record<string, unknown>; serverInfo: { name: string } };
  await client.sendNotification("initialized", {});
  const diagnostics = () =>
    new Promise<PublishDiagnosticsParams>((resolve) => {
      const ready = published.shift();
      if (ready) resolve(ready);
      else waiting.push(resolve);
    });
  let version = 1;
  const open = async (uri: string, text: string, languageId = "plaintext") => {
    await client.sendNotification("textDocument/didOpen", {
      textDocument: { uri, languageId, version, text },
    });
    return diagnostics();
  };
  const change = async (uri: string, text: string) => {
    version++;
    await client.sendNotification("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    });
    return diagnostics();
  };
  return { client, init, open, change, diagnostics };
}

afterEach(() => {
  for (const client of clients.splice(0)) client.dispose();
});

const position = (line: number, character: number) => ({ line, character });

describe("diagnostics", () => {
  it("publishes a finding with its rule, severity, range and page", async () => {
    const { open, init } = await start();
    expect(init.serverInfo.name).toBe("zimanyar-lsp");
    const { diagnostics } = await open("file:///a.txt", "Ez diçim malê.\nMin tu dîtim.");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      range: { start: position(1, 7), end: position(1, 12) },
      severity: 1,
      code: "kmr.ergative.agreement",
      source: "zimanyar",
      message: "In the past this verb agrees with the object, tu.",
      codeDescription: { href: "https://0xdolan.github.io/Zimanyar/rules/kmr.ergative.agreement/" },
    });
  });

  it("checks again when the text changes, and clears a closed document", async () => {
    const { client, open, change, diagnostics } = await start();
    expect((await open("file:///a.txt", "Min tu dîtim.")).diagnostics).toHaveLength(1);
    const changed = await change("file:///a.txt", "Ez diçim malê.");
    expect(changed.diagnostics).toEqual([]);
    expect(changed.version).toBe(2);
    await client.sendNotification("textDocument/didClose", { textDocument: { uri: "file:///a.txt" } });
    expect((await diagnostics()).diagnostics).toEqual([]);
  });

  it("checks only the prose of Markdown", async () => {
    const { open } = await start();
    const text = "`Min tu dîtim.`\n\nMin tu dîtim.\n";
    const { diagnostics } = await open("file:///a.md", text, "markdown");
    expect(diagnostics.map((diagnostic) => diagnostic.range.start.line)).toEqual([2]);
  });

  it("shows hints as information, which editors do not hide", async () => {
    const { open } = await start();
    const english = "This paragraph is written in English and has nothing Kurdish in it at all.";
    const { diagnostics } = await open("file:///a.txt", english);
    expect(diagnostics[0]?.severity).toBe(3);
  });
});

describe("settings", () => {
  it("takes the interface language and the rules from initializationOptions", async () => {
    const { open } = await start({ ui: "kmr", disable: ["any.space"] });
    const { diagnostics } = await open("file:///a.txt", "Min tu dîtim. Ez diçim  malê.");
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["kmr.ergative.agreement"]);
    expect(diagnostics[0]?.message).not.toBe("In the past this verb agrees with the object, tu.");
  });

  it("checks open documents again when the settings change", async () => {
    const { client, open, diagnostics } = await start();
    expect((await open("file:///a.txt", "Min tu dîtim.")).diagnostics).toHaveLength(1);
    await client.sendNotification("workspace/didChangeConfiguration", {
      settings: { zimanyar: { rules: ["ckb"] } },
    });
    expect((await diagnostics()).diagnostics).toEqual([]);
  });

  it("ignores what is not a setting of the right shape", () => {
    expect(settingsOf(null, DEFAULTS)).toBe(DEFAULTS);
    expect(
      settingsOf(
        { lang: "zza", ui: 3, rules: "kmr", disable: [1], tolerant: "yes", words: ["Hawar"] },
        DEFAULTS,
      ),
    ).toEqual({ ...DEFAULTS, words: ["Hawar"] });
    expect(settingsOf({ lang: "ckb", ui: "ckb", tolerant: true }, DEFAULTS)).toMatchObject({
      lang: "ckb",
      ui: "ckb",
      tolerant: true,
    });
  });

  it("accepts the words of a personal dictionary", async () => {
    const { open } = await start({ words: ["Zimanyar"], rules: ["kmr.spelling"] });
    expect((await open("file:///a.txt", "Zimanyar baş e.")).diagnostics).toEqual([]);
  });
});

describe("code actions", () => {
  it("offers each suggestion as a quick fix for the finding under the cursor", async () => {
    const { client, open } = await start();
    await open("file:///a.txt", "Min tu dîtim.");
    const actions = (await client.sendRequest("textDocument/codeAction", {
      textDocument: { uri: "file:///a.txt" },
      range: { start: position(0, 9), end: position(0, 9) },
      context: { diagnostics: [] },
    })) as CodeAction[];
    expect(actions[0]).toMatchObject({
      title: "Replace with dîtî",
      kind: "quickfix",
      edit: { changes: { "file:///a.txt": [{ range: { start: position(0, 7) }, newText: "dîtî" }] } },
    });
    const elsewhere = (await client.sendRequest("textDocument/codeAction", {
      textDocument: { uri: "file:///a.txt" },
      range: { start: position(0, 0), end: position(0, 2) },
      context: { diagnostics: [] },
    })) as CodeAction[];
    expect(elsewhere).toEqual([]);
  });

  it("fixes every safe spelling mistake at once, when the editor asks for source.fixAll", async () => {
    const { client, open } = await start();
    await open("file:///a.txt", "كوردستان جوانە.\nكوردستان");
    const actions = (await client.sendRequest("textDocument/codeAction", {
      textDocument: { uri: "file:///a.txt" },
      range: { start: position(0, 0), end: position(0, 0) },
      context: { diagnostics: [], only: ["source.fixAll"] },
    })) as CodeAction[];
    expect(actions).toHaveLength(1);
    expect(actions[0]?.kind).toBe("source.fixAll.zimanyar");
    expect(actions[0]?.edit?.changes?.["file:///a.txt"]?.[0]?.newText).toBe("کوردستان جوانە.\nکوردستان");
  });

  it("answers nothing for a document it does not have", async () => {
    const { client } = await start();
    const request = { textDocument: { uri: "file:///none.txt" }, position: position(0, 0) };
    expect(
      await client.sendRequest("textDocument/codeAction", {
        ...request,
        range: { start: position(0, 0), end: position(0, 0) },
        context: { diagnostics: [] },
      }),
    ).toEqual([]);
    expect(await client.sendRequest("textDocument/hover", request)).toBeNull();
    expect(await client.sendRequest("textDocument/completion", request)).toEqual([]);
  });
});

describe("hover", () => {
  it("explains the finding under the cursor, with the fix, the lesson and the rule", async () => {
    const { client, open } = await start();
    await open("file:///a.txt", "Min tu dîtim.");
    const hover = (await client.sendRequest("textDocument/hover", {
      textDocument: { uri: "file:///a.txt" },
      position: position(0, 9),
    })) as Hover;
    const { value } = hover.contents as MarkupContent;
    expect(value).toContain("**In the past this verb agrees with the object, tu\\.**");
    expect(value).toContain("Fix: dîtim → dîtî");
    expect(value).toMatch(/\]\(https:\/\/0xdolan\.github\.io\/Zimanyar\/learn\/kurmanji\/14-[^)]+\)/);
    expect(value).toContain("[`kmr.ergative.agreement`](https://0xdolan.github.io/Zimanyar/rules/");
    const none = await client.sendRequest("textDocument/hover", {
      textDocument: { uri: "file:///a.txt" },
      position: position(0, 1),
    });
    expect(none).toBeNull();
  });

  it("shows the document's own text as text, never as markup", async () => {
    const { client, open } = await start();
    await open("file:///a.txt", "Min tu dîtim.");
    const hover = (await client.sendRequest("textDocument/hover", {
      textDocument: { uri: "file:///a.txt" },
      position: position(0, 9),
    })) as Hover;
    expect(hover.range).toEqual({ start: position(0, 7), end: position(0, 12) });
    const finding = { ...(await localEngine({}).check("Min tu dîtim.", OPTIONS)).findings[0] } as Located;
    finding.text = "[x](javascript:alert)";
    finding.suggestions = [{ text: "<img src=x>" }];
    const { value } = hoverOf(finding, "en", createT("en")).contents as MarkupContent;
    expect(value).not.toContain("](javascript");
    expect(value).toContain("\\[x\\]\\(javascript:alert\\)");
    expect(value).toContain("\\<img src=x\\>");
  });
});

describe("completion", () => {
  it("needs two letters before it suggests", async () => {
    const { client, open } = await start();
    await open("file:///a.txt", "Ez d");
    expect(
      await client.sendRequest("textDocument/completion", {
        textDocument: { uri: "file:///a.txt" },
        position: position(0, 4),
      }),
    ).toEqual([]);
  });

  it.skipIf(!existsSync(lexiconPath("kmr")))("completes a Kurmanji word from the lexicon", async () => {
    const { client, open } = await start();
    await open("file:///a.txt", "Ez dibîn");
    const items = (await client.sendRequest("textDocument/completion", {
      textDocument: { uri: "file:///a.txt" },
      position: position(0, 8),
    })) as CompletionItem[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.label.startsWith("dibîn"))).toBe(true);
    expect(items[0]?.textEdit).toMatchObject({ range: { start: position(0, 3), end: position(0, 8) } });
  });
});

describe("engine", () => {
  it("reports a failure as an error response", async () => {
    const handle = engineHandler({
      check: () => Promise.reject(new Error("broken")),
      complete: () => Promise.reject("broken too"),
    });
    expect(
      await handle({
        id: 1,
        type: "check",
        text: "",
        options: { lang: "auto", markdown: false, fix: false },
      }),
    ).toEqual({ id: 1, type: "error", message: "broken" });
    expect(await handle({ id: 2, type: "complete", prefix: "ab", lang: "kmr", limit: 5 })).toEqual({
      id: 2,
      type: "error",
      message: "broken too",
    });
  });

  it("completes nothing for a prefix longer than any word", async () => {
    expect(await localEngine({}).complete("a".repeat(101), "kmr", 5)).toEqual([]);
  });

  it("talks to a worker thread, and fails its requests when the worker dies", async () => {
    const directory = mkdtempSync(join(tmpdir(), "zimanyar-worker-"));
    const answering = join(directory, "answering.cjs");
    writeFileSync(
      answering,
      `const { parentPort } = require("node:worker_threads");
parentPort.on("message", (r) => parentPort.postMessage(
  r.type === "check" ? { id: r.id, type: "checked", text: r.text, findings: [] }
  : r.prefix === "no" ? { id: r.id, type: "error", message: "no" }
  : r.prefix === "odd" ? { id: r.id, type: "checked", text: "", findings: [] }
  : { id: r.id, type: "completed", words: [r.prefix + "a"] }));`,
    );
    const engine = workerEngine(answering);
    const options = { lang: "auto", markdown: false, fix: false } as const;
    expect(await engine.check("text", options)).toEqual({ text: "text", findings: [] });
    expect(await engine.complete("di", "kmr", 5)).toEqual(["dia"]);
    await expect(engine.complete("no", "kmr", 5)).rejects.toThrow("no");
    await expect(engine.complete("odd", "kmr", 5)).rejects.toThrow("expected completed");
    const dying = join(directory, "dying.cjs");
    writeFileSync(
      dying,
      `require("node:worker_threads").parentPort.on("message", () => { throw new Error("died"); });`,
    );
    await expect(workerEngine(dying).check("text", options)).rejects.toThrow("died");
  });
});

describe("zimanyar lsp", () => {
  it("serves over standard input and output", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const io: Io = {
      out: () => {},
      err: () => {},
      readFile: () => "",
      writeFile: () => {},
      readStdin: async () => "",
      tty: false,
      env: {},
      input,
      output,
    };
    void run(["lsp", "--stdio"], io);
    const client = createProtocolConnection(new StreamMessageReader(output), new StreamMessageWriter(input));
    clients.push(client);
    client.listen();
    const init = (await client.sendRequest("initialize", {
      processId: null,
      rootUri: null,
      capabilities: {},
    })) as {
      capabilities: { hoverProvider: boolean };
    };
    expect(init.capabilities.hoverProvider).toBe(true);
  });
});
