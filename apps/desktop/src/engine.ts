import { CheckerClient } from "@zimanyar/checker";
import CheckerWorker from "@zimanyar/checker/worker?worker";
import type { EditorBackend } from "@zimanyar/editor";
import type { Variety } from "@zimanyar/rules";
import { filterFindings, type Settings } from "@zimanyar/settings";

/** One worker and its lexicons per window. They are files inside the app: this fetch never reaches a network. */
let client: CheckerClient | null = null;
const lexicons = new Map<Variety, Promise<void>>();
const refreshers = new Set<() => void>();

const connection = (): CheckerClient => {
  client ??= new CheckerClient(new CheckerWorker());
  return client;
};

function loadLexicon(lang: Variety): void {
  if (lexicons.has(lang)) return;
  lexicons.set(
    lang,
    fetch(`/lexicons/lexicon-${lang}.bin.gz`)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .then(async (buffer) => {
        if (buffer !== null) await connection().load(new Uint8Array(buffer));
        for (const refresh of refreshers) refresh();
      })
      .catch(() => {}),
  );
}

const scriptOf = (text: string): Variety => (/\p{Script=Arabic}/u.test(text) ? "ckb" : "kmr");

/** Be told when a lexicon arrives, to check again with spelling. */
export const onLexiconLoaded = (refresh: () => void): void => void refreshers.add(refresh);

/** The checker in a worker, with the writer's settings applied to what it finds. */
export function backendFor(settings: () => Settings): EditorBackend {
  return {
    check: async (text, options) => {
      loadLexicon(options.lang === "ckb" || options.lang === "kmr" ? options.lang : scriptOf(text));
      return filterFindings(await connection().check(text, options), text, settings());
    },
    suggest: (word, lang) => connection().suggest(word, lang),
    complete: (prefix, lang, limit) => {
      loadLexicon(lang);
      return connection().complete(prefix, lang, limit);
    },
  };
}
