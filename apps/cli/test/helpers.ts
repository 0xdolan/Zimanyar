import { PassThrough } from "node:stream";
import { run } from "../src/cli.js";
import type { Io } from "../src/io.js";

export interface Ran {
  code: number;
  out: string;
  err: string;
  files: Map<string, string>;
}

/** Run the command line against files in memory, with colour off unless asked. */
export async function cli(
  argv: readonly string[],
  {
    files = {},
    stdin = "",
    tty = false,
    env = {},
  }: {
    files?: Record<string, string>;
    stdin?: string;
    tty?: boolean;
    env?: Record<string, string>;
  } = {},
): Promise<Ran> {
  const store = new Map(Object.entries(files));
  let out = "";
  let err = "";
  const io: Io = {
    out: (text) => {
      out += text;
    },
    err: (text) => {
      err += text;
    },
    readFile: (path) => {
      const text = store.get(path);
      if (text === undefined) throw new Error(`ENOENT: ${path}`);
      return text;
    },
    writeFile: (path, text) => {
      store.set(path, text);
    },
    readStdin: async () => stdin,
    tty,
    env,
    input: new PassThrough(),
    output: new PassThrough(),
  };
  const code = await run(argv, io);
  return { code, out, err, files: store };
}
