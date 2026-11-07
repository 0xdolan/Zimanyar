import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import {
  type Engine,
  type EngineRequest,
  type EngineResponse,
  engineHandler,
  localEngine,
} from "./engine.js";

/** What the bundle is given when it starts as the checker's worker rather than as a command. */
const MARK = "zimanyar-checker";

export const isCheckerWorker = (): boolean => !isMainThread && workerData === MARK;

/** The worker's side: requests from the language server in, answers out. */
export function runWorker(env: Readonly<Record<string, string | undefined>>): void {
  const handle = engineHandler(localEngine(env));
  parentPort?.on("message", (request: EngineRequest) => {
    void handle(request).then((response) => parentPort?.postMessage(response));
  });
}

/** A request before it has its id. */
type Unsent = {
  [Type in EngineRequest["type"]]: Omit<Extract<EngineRequest, { type: Type }>, "id">;
}[EngineRequest["type"]];

/**
 * The checker in a worker thread started from the bundle itself, so that a long check never holds up
 * the editor's other requests. A worker that fails takes its pending requests with it.
 */
export function workerEngine(bundle: string): Engine {
  const worker = new Worker(bundle, { workerData: MARK });
  // The worker never keeps the server alive: the server ends when the editor closes its input.
  worker.unref();
  const pending = new Map<
    number,
    { resolve: (response: EngineResponse) => void; reject: (error: Error) => void }
  >();
  let next = 1;
  worker.on("message", (response: EngineResponse) => {
    pending.get(response.id)?.resolve(response);
    pending.delete(response.id);
  });
  worker.on("error", (error) => {
    for (const waiting of pending.values()) waiting.reject(error);
    pending.clear();
  });
  const send = (request: Unsent): Promise<EngineResponse> =>
    new Promise((resolve, reject) => {
      const id = next++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ ...request, id });
    });
  const answer = <Type extends EngineResponse["type"]>(response: EngineResponse, type: Type) => {
    if (response.type === "error") throw new Error(response.message);
    if (response.type !== type) throw new Error(`expected ${type}, got ${response.type}`);
    return response as Extract<EngineResponse, { type: Type }>;
  };
  return {
    async check(text, options) {
      const { text: checked, findings } = answer(await send({ type: "check", text, options }), "checked");
      return { text: checked, findings };
    },
    async complete(prefix, lang, limit) {
      return answer(await send({ type: "complete", prefix, lang, limit }), "completed").words;
    },
  };
}

/**
 * A worker where the bundle can start one: Node runs the CommonJS bundle as a worker, but not a single
 * executable's embedded script, nor TypeScript from source. There, the checker runs in this thread.
 */
export function engineFor(env: Readonly<Record<string, string | undefined>>): Engine {
  let sea = false;
  try {
    sea = (process.getBuiltinModule?.("node:sea") as typeof import("node:sea") | undefined)?.isSea() ?? false;
  } catch {
    sea = false;
  }
  const bundle = typeof __filename === "string" && __filename.endsWith(".cjs") ? __filename : undefined;
  return bundle !== undefined && !sea ? workerEngine(bundle) : localEngine(env);
}
