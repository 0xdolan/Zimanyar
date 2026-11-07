import type { EditorBackend } from "@zimanyar/editor";
import type { Finding } from "@zimanyar/rules";
import { filterFindings, type Settings } from "@zimanyar/settings";
import { browser } from "wxt/browser";

let next = 1;

async function ask<Reply>(message: Record<string, unknown>): Promise<Reply> {
  const reply = (await browser.runtime.sendMessage({ ...message, id: next++ })) as Reply & {
    type?: string;
    message?: string;
  };
  if (reply?.type === "error") throw new Error(reply.message);
  return reply;
}

/** The checker in the background, with the writer's settings applied to what it finds. */
export function backendFor(settings: () => Settings, origin?: string): EditorBackend {
  return {
    check: async (text, options) => {
      const { findings } = await ask<{ findings: Finding[] }>({ type: "check", text, options });
      return filterFindings(findings, text, settings(), origin);
    },
    suggest: async (word, lang) => (await ask<{ words: string[] }>({ type: "suggest", word, lang })).words,
    complete: async (prefix, lang, limit) =>
      (
        await ask<{ completions: { word: string; attested: boolean }[] }>({
          type: "complete",
          prefix,
          lang,
          limit,
        })
      ).completions,
  };
}
