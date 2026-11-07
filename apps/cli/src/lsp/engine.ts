import { Checker } from "@zimanyar/checker";
import type { Variety } from "@zimanyar/rules";
import { checkText, type Located, loadLexicons, type TextOptions } from "../check.js";

/** What the language server asks of the checker, which runs in a worker thread when it can. */
export interface Engine {
  check(text: string, options: TextOptions): Promise<{ text: string; findings: Located[] }>;
  complete(prefix: string, lang: Variety, limit: number): Promise<string[]>;
}

/** Longer than any word: the search for one word grows with its length. */
const LONGEST_PREFIX = 100;

/** The checker in this thread. */
export function localEngine(env: Readonly<Record<string, string | undefined>>): Engine {
  const checker = new Checker();
  return {
    check: (text, options) => checkText(checker, text, options, env),
    async complete(prefix, lang, limit) {
      if (prefix.length > LONGEST_PREFIX) return [];
      await loadLexicons(checker, [lang], env);
      return checker.complete(prefix, lang, limit).map((completion) => completion.word);
    },
  };
}

export type EngineRequest =
  | { id: number; type: "check"; text: string; options: TextOptions }
  | { id: number; type: "complete"; prefix: string; lang: Variety; limit: number };

export type EngineResponse =
  | { id: number; type: "checked"; text: string; findings: Located[] }
  | { id: number; type: "completed"; words: string[] }
  | { id: number; type: "error"; message: string };

/** One request in, one response out: the worker's behaviour, without the worker. */
export function engineHandler(engine: Engine): (request: EngineRequest) => Promise<EngineResponse> {
  return async (request) => {
    try {
      if (request.type === "check") {
        const { text, findings } = await engine.check(request.text, request.options);
        return { id: request.id, type: "checked", text, findings };
      }
      const words = await engine.complete(request.prefix, request.lang, request.limit);
      return { id: request.id, type: "completed", words };
    } catch (error) {
      return {
        id: request.id,
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  };
}
