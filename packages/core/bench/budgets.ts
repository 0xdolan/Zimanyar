/**
 * Hold the engine to its performance budgets, on the real lexicons. Each figure is the best of
 * several runs, because a busy machine only ever makes a run slower.
 *
 *   pnpm --filter @zimanyar/core bench     (or: make bench, after make data)
 */
import { loadLexiconFile, readFixture } from "@zimanyar/data/node";
import { ckb, complete, kmr, lexiconAdapter, suggest } from "../src/index.js";

interface Budget {
  name: string;
  microseconds: number;
  budget: number;
}

/** Microseconds per item: the best of several runs, after one to warm up the JIT. */
function measure<T>(items: readonly T[], work: (item: T) => unknown, runs = 4): number {
  for (const item of items) work(item);
  let best = Number.POSITIVE_INFINITY;
  for (let run = 0; run < runs; run++) {
    const started = performance.now();
    for (const item of items) work(item);
    best = Math.min(best, ((performance.now() - started) * 1000) / items.length);
  }
  return best;
}

const results: Budget[] = [];
for (const lang of ["ckb", "kmr"] as const) {
  const lexicon = await loadLexiconFile(lang);
  const words = readFixture<{ input: string }>(`${lang}_analyze`).map((r) => r.input);
  const adapter = lexiconAdapter(lexicon);
  const analyzer = lang === "ckb" ? new ckb.CkbAnalyzer(adapter) : new kmr.KmrAnalyzer(adapter);
  const sample = words.filter((_, i) => i % 30 === 0);
  results.push(
    { name: `${lang} lexicon lookup`, microseconds: measure(words, (w) => lexicon.has(w)), budget: 2 },
    {
      name: `${lang} analysis of one token`,
      microseconds: measure(sample, (w) => analyzer.analyze(w, true)),
      budget: 50,
    },
    {
      name: `${lang} suggestions for one word`,
      microseconds: measure(sample.slice(0, 40), (w) => suggest(`${w}x`, lexicon), 2),
      budget: 50_000,
    },
    {
      name: `${lang} completion of a prefix`,
      microseconds: measure(sample.slice(0, 200), (w) => complete(w.slice(0, 3), lexicon), 2),
      budget: 20_000,
    },
  );
}

let failed = false;
for (const { name, microseconds, budget } of results) {
  const over = microseconds > budget;
  failed ||= over;
  console.log(`${over ? "OVER" : "ok  "} ${name}: ${microseconds.toFixed(2)} us (budget ${budget})`);
}
process.exitCode = failed ? 1 : 0;
