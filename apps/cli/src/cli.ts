import { parseArgs } from "node:util";
import { Checker } from "@zimanyar/checker";
import { declension } from "@zimanyar/content";
import { createT, type Translate, type UiLang } from "@zimanyar/i18n";
import type { Strictness, Variety } from "@zimanyar/rules";
import { parseDictionary } from "@zimanyar/settings";
import { createConnection } from "vscode-languageserver/node";
import { type CheckedFile, checkText, disabledBy, type FailOn, failsOn, unknownRules } from "./check.js";
import { jsonReport } from "./format/json.js";
import { sarifReport } from "./format/sarif.js";
import { textReport } from "./format/text.js";
import type { Io } from "./io.js";
import { serve } from "./lsp/server.js";
import { engineFor } from "./lsp/worker.js";
import { isMarkdown } from "./markdown.js";
import { DATA_VERSION, VERSION, ZIMANKIT_VERSION } from "./meta.js";
import {
  explainText,
  findLessons,
  findRule,
  LESSONS,
  lessonList,
  lessonText,
  similarRules,
} from "./teach.js";
import { type Paint, paintFor } from "./terminal.js";
import {
  declensionText,
  gendersOf,
  ipaOf,
  lidText,
  normalizedOf,
  paradigmOf,
  paradigmText,
  readingsOf,
  readingsTable,
  translitOf,
  varietyOf,
} from "./words.js";

const EXIT = { clean: 0, findings: 1, usage: 2 } as const;

/** A mistake in how the command was called, reported with exit code 2. */
class UsageError extends Error {}

/** The interface language: --ui, then ZIMANYAR_UI, then the locale (ckb_IQ is Sorani, ku_TR Kurmanji). */
export function uiLangOf(
  flag: string | undefined,
  env: Readonly<Record<string, string | undefined>>,
): UiLang {
  const pick = (value: string | undefined): UiLang | null => {
    if (value === undefined || value === "") return null;
    if (/^ckb/i.test(value)) return "ckb";
    if (/^(kmr|ku)([_.@-]|$)/i.test(value)) return "kmr";
    if (/^en([_.@-]|$)/i.test(value)) return "en";
    return null;
  };
  return (
    pick(flag) ??
    pick(env["ZIMANYAR_UI"]) ??
    pick(env["LC_ALL"]) ??
    pick(env["LC_MESSAGES"]) ??
    pick(env["LANG"]) ??
    "en"
  );
}

interface Context {
  io: Io;
  t: Translate;
  ui: UiLang;
  paint: Paint;
}

const COMMANDS = [
  "check",
  "analyze",
  "conjugate",
  "decline",
  "ipa",
  "translit",
  "normalize",
  "lid",
  "explain",
  "lesson",
  "lsp",
] as const;
type Command = (typeof COMMANDS)[number];

function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  option: string,
  t: Translate,
): T | undefined {
  if (value === undefined) return undefined;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new UsageError(t("cli.error.value", { option, value, allowed: allowed.join(", ") }));
}

const list = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

function help(t: Translate, command?: Command): string {
  const usage: Record<Command, [string, string]> = {
    check: [
      "zimanyar check [files…|-] [--lang ckb|kmr|auto] [--format text|json|sarif] [--fix] [--rules …] [--disable …] [--fail-on error|warning|hint|never] [--tolerant] [--markdown] [--dictionary file]",
      t("cli.help.check"),
    ],
    analyze: ["zimanyar analyze <word> [--lang ckb|kmr] [--format text|json]", t("cli.help.analyze")],
    conjugate: [
      "zimanyar conjugate <infinitive> [--lang ckb|kmr] [--format text|json]",
      t("cli.help.conjugate"),
    ],
    decline: [
      "zimanyar decline <noun> [--lang ckb|kmr] [--gender f|m] [--format text|json]",
      t("cli.help.decline"),
    ],
    ipa: ["zimanyar ipa <text…|->", t("cli.help.ipa")],
    translit: ["zimanyar translit <text…|->", t("cli.help.translit")],
    normalize: ["zimanyar normalize <text…|-> [--lang ckb|kmr]", t("cli.help.normalize")],
    lid: ["zimanyar lid <text…|->", t("cli.help.lid")],
    explain: ["zimanyar explain <rule-id>", t("cli.help.explain")],
    lesson: ["zimanyar lesson [number|rule-id|words] [--lang ckb|kmr]", t("cli.help.lesson")],
    lsp: ["zimanyar lsp [--stdio]", t("cli.help.lsp")],
  };
  if (command !== undefined) {
    const [line, text] = usage[command];
    return `${line}\n\n${text}\n`;
  }
  return [
    t("cli.help.intro"),
    "",
    ...COMMANDS.flatMap((name) => [`  ${usage[name][0]}`, `      ${usage[name][1]}`]),
    "",
    t("cli.help.global"),
    "",
    t("cli.help.exit"),
    "",
  ].join("\n");
}

/**
 * The words of a personal dictionary: the JSON list the extension and the desktop app export, or a
 * text file with one word on each line, where # starts a comment.
 */
export function wordsOf(source: string): string[] {
  const exported = parseDictionary(source);
  if (exported !== null) return exported;
  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter(Boolean);
}

/** The text a word tool works on: its arguments, or standard input for none or "-". */
async function textOf(positionals: readonly string[], io: Io): Promise<string> {
  if (positionals.length === 0 || (positionals.length === 1 && positionals[0] === "-")) {
    return (await io.readStdin()).replace(/\n$/, "");
  }
  return positionals.join(" ");
}

const LANGS = ["ckb", "kmr", "auto"] as const;
const VARIETIES = ["ckb", "kmr"] as const;

async function runCheck(args: string[], { io, t, ui, paint }: Context): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      lang: { type: "string" },
      format: { type: "string" },
      fix: { type: "boolean" },
      rules: { type: "string" },
      disable: { type: "string" },
      "fail-on": { type: "string" },
      tolerant: { type: "boolean" },
      markdown: { type: "boolean" },
      dictionary: { type: "string", multiple: true },
    },
  });
  const lang = oneOf(values.lang, LANGS, "--lang", t) ?? "auto";
  const format = oneOf(values.format, ["text", "json", "sarif"] as const, "--format", t) ?? "text";
  const failOn: FailOn =
    oneOf(values["fail-on"], ["error", "warning", "hint", "never"] as const, "--fail-on", t) ?? "error";
  const strictness: Strictness = values.tolerant ? "tolerant" : "standard";
  const only = list(values.rules);
  const disable = list(values.disable);
  const unknown = unknownRules([...only, ...disable]);
  if (unknown.length > 0) throw new UsageError(t("cli.error.rules", { rules: unknown.join(", ") }));
  const paths = positionals.length > 0 ? positionals : ["-"];
  const words = new Set<string>();
  for (const path of values.dictionary ?? []) {
    let source: string;
    try {
      source = io.readFile(path);
    } catch {
      throw new UsageError(t("cli.error.read", { path }));
    }
    for (const word of wordsOf(source)) words.add(word);
  }
  const checker = new Checker();
  const files: CheckedFile[] = [];
  let fixedFiles = 0;
  for (const path of paths) {
    let text: string;
    try {
      text = path === "-" ? await io.readStdin() : io.readFile(path);
    } catch {
      throw new UsageError(t("cli.error.read", { path }));
    }
    const checked = await checkText(
      checker,
      text,
      {
        lang,
        strictness,
        disabledRules: disabledBy(only, disable),
        words,
        markdown: values.markdown === true || (path !== "-" && isMarkdown(path)),
        fix: values.fix === true,
      },
      io.env,
    );
    if (values.fix && checked.text !== text) {
      fixedFiles++;
      if (path !== "-") io.writeFile(path, checked.text);
    }
    files.push({ path, text: checked.text, findings: checked.findings });
  }
  const findings = files.flatMap((file) => file.findings);
  if (values.fix && paths.length === 1 && paths[0] === "-") {
    // Corrected text goes where it can be piped; what is left to fix goes to the error stream.
    io.out((files[0] as CheckedFile).text);
    if (findings.length > 0) io.err(textReport(files, ui, t, paintFor(false, io.env)));
    return failsOn(findings, failOn) ? EXIT.findings : EXIT.clean;
  }
  if (format === "json") io.out(jsonReport(files, ui));
  else if (format === "sarif") io.out(sarifReport(files, ui));
  else {
    io.out(textReport(files, ui, t, paint));
    if (values.fix) io.out(`${t("cli.check.fixed", { files: fixedFiles })}\n`);
  }
  return failsOn(findings, failOn) ? EXIT.findings : EXIT.clean;
}

/** The language server, over standard input and output until the editor closes them. */
function runLsp(args: string[], { io, ui }: Context): Promise<number> {
  // Editors pass --stdio by habit; it is the only transport there is.
  parseArgs({ args, options: { stdio: { type: "boolean" } } });
  serve(createConnection(io.input, io.output), engineFor(io.env), {
    lang: "auto",
    ui,
    rules: [],
    disable: [],
    tolerant: false,
    words: [],
  });
  return new Promise(() => {});
}

async function runWords(
  command: Exclude<Command, "check" | "lsp">,
  args: string[],
  { io, t, ui, paint }: Context,
): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { lang: { type: "string" }, format: { type: "string" }, gender: { type: "string" } },
  });
  const json = (oneOf(values.format, ["text", "json"] as const, "--format", t) ?? "text") === "json";
  const out = (text: string) => io.out(text.endsWith("\n") ? text : `${text}\n`);
  const needOne = () => {
    if (positionals.length !== 1) throw new UsageError(help(t, command));
    return positionals[0] as string;
  };
  const langFor = (text: string) => varietyOf(text, oneOf(values.lang, LANGS, "--lang", t) ?? "auto");
  switch (command) {
    case "analyze": {
      const word = needOne();
      const readings = await readingsOf(word, langFor(word), io.env);
      out(json ? JSON.stringify(readings, null, 2) : readingsTable(readings, t, paint));
      return EXIT.clean;
    }
    case "conjugate": {
      const infinitive = needOne();
      let paradigm: ReturnType<typeof paradigmOf>;
      try {
        paradigm = paradigmOf(infinitive, langFor(infinitive));
      } catch {
        throw new UsageError(t("cli.error.verb", { word: infinitive }));
      }
      out(json ? JSON.stringify(paradigm, null, 2) : paradigmText(paradigm, t, paint));
      return EXIT.clean;
    }
    case "decline": {
      const noun = needOne();
      const lang = langFor(noun);
      const given = oneOf(values.gender, ["f", "m"] as const, "--gender", t);
      const genders = await gendersOf(noun, lang, given, io.env);
      if (json) {
        out(
          JSON.stringify(
            genders.map((gender) => ({
              noun,
              lang,
              ...(lang === "kmr" ? { gender } : {}),
              forms: declension(lang, noun, gender),
            })),
            null,
            2,
          ),
        );
      } else {
        out(declensionText(noun, lang, genders, t, paint));
        if (lang === "kmr" && genders.length > 1) io.err(`${t("cli.decline.unknownGender")}\n`);
      }
      return EXIT.clean;
    }
    case "ipa":
      out(ipaOf(await textOf(positionals, io)));
      return EXIT.clean;
    case "translit":
      out(translitOf(await textOf(positionals, io)));
      return EXIT.clean;
    case "normalize": {
      const text = await textOf(positionals, io);
      out(normalizedOf(text, langFor(text)));
      return EXIT.clean;
    }
    case "lid":
      out(lidText(await textOf(positionals, io), t));
      return EXIT.clean;
    case "explain": {
      const id = needOne();
      const meta = findRule(id);
      if (meta === undefined) {
        const similar = similarRules(id);
        throw new UsageError(
          [
            t("cli.error.rule", { rule: id }),
            ...(similar.length > 0 ? [t("cli.error.similar", { rules: similar.join(", ") })] : []),
          ].join("\n"),
        );
      }
      out(explainText(meta, ui, t, paint));
      return EXIT.clean;
    }
    case "lesson": {
      const course = oneOf(values.lang, VARIETIES, "--lang", t) as Variety | undefined;
      const topic = positionals.join(" ").trim();
      const found =
        topic === ""
          ? LESSONS.filter((lesson) => course === undefined || lesson.lang === course)
          : findLessons(topic, course);
      if (found.length === 0) throw new UsageError(t("cli.error.lesson", { topic }));
      if (found.length === 1) out(lessonText(found[0] as (typeof found)[number], paint));
      else {
        out(lessonList(found, t, paint));
        if (topic !== "") io.err(`${t("cli.lesson.choose")}\n`);
      }
      return EXIT.clean;
    }
    default:
      return EXIT.usage;
  }
}

/** Run the command line: the arguments after the program's name in, an exit code out. */
export async function run(argv: readonly string[], io: Io): Promise<number> {
  // The interface language is read first, so that even a usage error is in it.
  const uiIndex = argv.findIndex((arg) => arg === "--ui" || arg.startsWith("--ui="));
  const uiFlag =
    uiIndex < 0 ? undefined : argv[uiIndex]?.includes("=") ? argv[uiIndex]?.split("=")[1] : argv[uiIndex + 1];
  const args =
    uiIndex < 0
      ? [...argv]
      : argv.filter(
          (_, index) => index !== uiIndex && (argv[uiIndex]?.includes("=") || index !== uiIndex + 1),
        );
  const ui = uiLangOf(uiFlag, io.env);
  const t = createT(ui, { easternDigits: false });
  const context: Context = { io, t, ui, paint: paintFor(io.tty, io.env) };
  const [first, ...rest] = args;
  try {
    if (first === undefined || first === "--help" || first === "-h" || first === "help") {
      const command = COMMANDS.find((name) => name === rest[0]);
      // Called with nothing, the help is a usage error: it goes to the error stream.
      if (first === undefined) {
        io.err(help(t));
        return EXIT.usage;
      }
      io.out(help(t, command));
      return EXIT.clean;
    }
    if (first === "--version" || first === "-v" || first === "version") {
      io.out(`zimanyar ${VERSION} (data ${DATA_VERSION}, zimankit ${ZIMANKIT_VERSION})\n`);
      return EXIT.clean;
    }
    const command = COMMANDS.find((name) => name === first);
    if (command === undefined)
      throw new UsageError(`${t("cli.error.command", { command: first })}\n\n${help(t)}`);
    if (rest.includes("--help") || rest.includes("-h")) {
      io.out(help(t, command));
      return EXIT.clean;
    }
    if (command === "check") return await runCheck(rest, context);
    if (command === "lsp") return await runLsp(rest, context);
    return await runWords(command, rest, context);
  } catch (error) {
    if (error instanceof UsageError) {
      io.err(`${error.message.trimEnd()}\n`);
      return EXIT.usage;
    }
    // parseArgs reports unknown options and missing values with a code of its own.
    if (error instanceof Error && "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS")) {
      io.err(`${error.message}\n`);
      return EXIT.usage;
    }
    throw error;
  }
}
