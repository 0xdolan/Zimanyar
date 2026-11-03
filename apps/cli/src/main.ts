import { run } from "./cli.js";
import { processIo } from "./io.js";

run(process.argv.slice(2), processIo).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 3;
  },
);
