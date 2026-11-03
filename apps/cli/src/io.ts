import { readFileSync, writeFileSync } from "node:fs";

/** Everything the commands touch outside themselves, so tests can run them without a terminal. */
export interface Io {
  out(text: string): void;
  err(text: string): void;
  readFile(path: string): string;
  writeFile(path: string, text: string): void;
  readStdin(): Promise<string>;
  /** Whether standard output is a terminal, which allows colour. */
  tty: boolean;
  env: Readonly<Record<string, string | undefined>>;
}

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/* v8 ignore start: the real process, which the end-to-end test runs */
export const processIo: Io = {
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
  readFile: (path) => readFileSync(path, "utf8"),
  writeFile: (path, text) => writeFileSync(path, text, "utf8"),
  readStdin: () => readAll(process.stdin),
  tty: process.stdout.isTTY === true,
  env: process.env,
};
/* v8 ignore stop */
