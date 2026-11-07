import { run } from "./cli.js";
import { processIo } from "./io.js";
import { isCheckerWorker, runWorker } from "./lsp/worker.js";

// The language server starts this same bundle as its checker's worker thread.
if (isCheckerWorker()) {
  runWorker(process.env);
} else {
  run(process.argv.slice(2), processIo).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
      process.exitCode = 3;
    },
  );
}
