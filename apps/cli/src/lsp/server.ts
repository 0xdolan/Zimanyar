import { createT, type Translate, type UiLang } from "@zimanyar/i18n";
import { renderMessage, type Severity, type Variety } from "@zimanyar/rules";
import {
  type CodeAction,
  CodeActionKind,
  type CompletionItem,
  CompletionItemKind,
  type Connection,
  type Diagnostic,
  DiagnosticSeverity,
  type Hover,
  MarkupKind,
  type Range,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { disabledBy, type Located, lessonsFirst, type TextOptions } from "../check.js";
import { isMarkdown } from "../markdown.js";
import { lessonUrl, ruleUrl, VERSION } from "../meta.js";
import type { Engine } from "./engine.js";

/** What an editor may set, in initializationOptions or as the zimanyar section of its settings. */
export interface Settings {
  lang: Variety | "auto";
  ui: UiLang;
  /** Rule ids or prefixes to run only, and to leave out, as check --rules and --disable. */
  rules: string[];
  disable: string[];
  tolerant: boolean;
  /** Words to accept as spelled right. */
  words: string[];
}

const strings = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;

/** Settings from an editor, which is not trusted to send the right shapes: what is wrong is ignored. */
export function settingsOf(value: unknown, base: Settings): Settings {
  if (typeof value !== "object" || value === null) return base;
  const given = value as Record<string, unknown>;
  const lang = given["lang"];
  const ui = given["ui"];
  return {
    lang: lang === "ckb" || lang === "kmr" || lang === "auto" ? lang : base.lang,
    ui: ui === "en" || ui === "ckb" || ui === "kmr" ? ui : base.ui,
    rules: strings(given["rules"]) ?? base.rules,
    disable: strings(given["disable"]) ?? base.disable,
    tolerant: typeof given["tolerant"] === "boolean" ? given["tolerant"] : base.tolerant,
    words: strings(given["words"]) ?? base.words,
  };
}

const SEVERITY: Readonly<Record<Severity, DiagnosticSeverity>> = {
  error: DiagnosticSeverity.Error,
  warning: DiagnosticSeverity.Warning,
  // Many editors hide hints entirely: information is shown, quietly.
  hint: DiagnosticSeverity.Information,
};

const rangeOf = (finding: Located): Range => ({
  start: { line: finding.line - 1, character: finding.column - 1 },
  end: { line: finding.endLine - 1, character: finding.endColumn - 1 },
});

function diagnosticOf(finding: Located, ui: UiLang): Diagnostic {
  return {
    range: rangeOf(finding),
    severity: SEVERITY[finding.severity],
    code: finding.ruleId,
    codeDescription: { href: ruleUrl(finding.ruleId) },
    source: "zimanyar",
    message: renderMessage(finding.message, ui),
  };
}

/** Text from the document, shown as itself in a Markdown hover rather than as markup. */
const literal = (text: string) => text.replace(/[\\`*_{}[\]()#+\-.!|<>~]/g, "\\$&");

export function hoverOf(finding: Located, ui: UiLang, t: Translate): Hover {
  const parts = [
    `**${literal(renderMessage(finding.message, ui))}**`,
    literal(renderMessage(finding.reason, ui)),
  ];
  const fix = finding.suggestions.map((suggestion) => suggestion.text).join(", ");
  if (fix !== "") parts.push(literal(t("cli.check.fix", { text: finding.text, fix })));
  const lesson = lessonsFirst(finding)[0];
  if (lesson !== undefined) {
    const url = lessonUrl(lesson); // The link is markup of ours: only the words around it are escaped.
    const [before = "", after = ""] = t("cli.check.lesson", { url: "\n" }).split("\n");
    parts.push(`${literal(before)}[${literal(lesson.title)}](${url})${literal(after)}`);
  }
  parts.push(`[\`${finding.ruleId}\`](${ruleUrl(finding.ruleId)})`);
  return { contents: { kind: MarkupKind.Markdown, value: parts.join("\n\n") }, range: rangeOf(finding) };
}

/** Whether a code action of this kind was asked for: none named means any. */
const wanted = (kind: string, only: readonly string[] | undefined) =>
  only === undefined || only.some((asked) => kind === asked || kind.startsWith(`${asked}.`));

const FIX_ALL = `${CodeActionKind.SourceFixAll}.zimanyar`;
/** Long enough to type a word, short enough to feel immediate. */
const PAUSE_MS = 200;

/**
 * The language server: diagnostics as the document changes, a quick fix for each suggestion, a fix of
 * every safe spelling mistake, hovers that explain a finding, and completion of Kurdish words.
 */
export function serve(connection: Connection, engine: Engine, defaults: Settings): void {
  const documents = new TextDocuments(TextDocument);
  /** The findings of each open document, for the version they were made for. */
  const checked = new Map<string, { version: number; findings: Located[] }>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let settings = defaults;
  let t = createT(settings.ui, { easternDigits: false });

  const optionsFor = (document: TextDocument, fix = false): TextOptions => ({
    lang: settings.lang,
    markdown: ["markdown", "mdx"].includes(document.languageId) || isMarkdown(document.uri),
    fix,
    words: new Set(settings.words),
    strictness: settings.tolerant ? "tolerant" : "standard",
    disabledRules: disabledBy(settings.rules, settings.disable),
  });

  const findingsNow = (document: TextDocument): Located[] => {
    const entry = checked.get(document.uri);
    return entry !== undefined && entry.version === document.version ? entry.findings : [];
  };

  async function validate(document: TextDocument): Promise<void> {
    const { version, uri } = document;
    try {
      const { findings } = await engine.check(document.getText(), optionsFor(document));
      // A newer version is already on its way: these findings would point at the wrong text.
      if (documents.get(uri)?.version !== version) return;
      checked.set(uri, { version, findings });
      await connection.sendDiagnostics({
        uri,
        version,
        diagnostics: findings.map((finding) => diagnosticOf(finding, settings.ui)),
      });
    } catch (error) {
      connection.console.error(`zimanyar: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const schedule = (document: TextDocument, pause = PAUSE_MS) => {
    clearTimeout(timers.get(document.uri));
    timers.set(
      document.uri,
      setTimeout(() => {
        timers.delete(document.uri);
        void validate(document);
      }, pause),
    );
  };

  connection.onInitialize((params) => {
    settings = settingsOf(params.initializationOptions, settings);
    t = createT(settings.ui, { easternDigits: false });
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        codeActionProvider: { codeActionKinds: [CodeActionKind.QuickFix, FIX_ALL] },
        hoverProvider: true,
        completionProvider: { resolveProvider: false },
      },
      serverInfo: { name: "zimanyar-lsp", version: VERSION },
    };
  });

  connection.onDidChangeConfiguration((params) => {
    const section = (params.settings as { zimanyar?: unknown } | null | undefined)?.zimanyar;
    settings = settingsOf(section, settings);
    t = createT(settings.ui, { easternDigits: false });
    for (const document of documents.all()) schedule(document, 0);
  });

  documents.onDidOpen(({ document }) => schedule(document, 0));
  documents.onDidChangeContent(({ document }) => schedule(document));
  documents.onDidClose(({ document }) => {
    clearTimeout(timers.get(document.uri));
    timers.delete(document.uri);
    checked.delete(document.uri);
    void connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
  });

  connection.onCodeAction(async ({ textDocument, range, context }) => {
    const document = documents.get(textDocument.uri);
    if (document === undefined) return [];
    const findings = findingsNow(document);
    const start = document.offsetAt(range.start);
    const end = document.offsetAt(range.end);
    const actions: CodeAction[] = [];
    if (wanted(CodeActionKind.QuickFix, context.only)) {
      for (const finding of findings) {
        if (finding.range.start > end || finding.range.end < start) continue;
        finding.suggestions.forEach((suggestion, index) => {
          actions.push({
            title: t("cli.lsp.replace", { text: suggestion.text }),
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnosticOf(finding, settings.ui)],
            isPreferred: index === 0 && finding.safeFix,
            edit: { changes: { [document.uri]: [{ range: rangeOf(finding), newText: suggestion.text }] } },
          });
        });
      }
    }
    if (wanted(FIX_ALL, context.only) && findings.some((finding) => finding.safeFix)) {
      const before = document.getText();
      const { text } = await engine.check(before, optionsFor(document, true));
      if (text !== before && documents.get(document.uri)?.version === document.version) {
        actions.push({
          title: t("cli.lsp.fixAll"),
          kind: FIX_ALL,
          edit: {
            changes: {
              [document.uri]: [
                {
                  range: { start: { line: 0, character: 0 }, end: document.positionAt(before.length) },
                  newText: text,
                },
              ],
            },
          },
        });
      }
    }
    return actions;
  });

  connection.onHover(({ textDocument, position }) => {
    const document = documents.get(textDocument.uri);
    if (document === undefined) return null;
    const offset = document.offsetAt(position);
    const finding = findingsNow(document).find(({ range }) => range.start <= offset && offset <= range.end);
    return finding === undefined ? null : hoverOf(finding, settings.ui, t);
  });

  connection.onCompletion(async ({ textDocument, position }): Promise<CompletionItem[]> => {
    const document = documents.get(textDocument.uri);
    if (document === undefined) return [];
    const before = document.getText({ start: { line: position.line, character: 0 }, end: position });
    // Letters, marks and the joiners Sorani writes inside words.
    const prefix = /[\p{L}\p{M}\p{Cf}]+$/u.exec(before)?.[0] ?? "";
    if (prefix.length < 2) return [];
    const lang: Variety = /\p{Script=Arabic}/u.test(prefix) ? "ckb" : "kmr";
    const range: Range = {
      start: { line: position.line, character: position.character - prefix.length },
      end: position,
    };
    const words = await engine.complete(prefix, lang, 20);
    return words.map((word, index) => ({
      label: word,
      kind: CompletionItemKind.Text,
      sortText: String(index).padStart(3, "0"),
      textEdit: { range, newText: word },
    }));
  });

  documents.listen(connection);
  connection.listen();
}
