import type { Completion } from "@zimanyar/core";
import type { Finding, Variety } from "@zimanyar/rules";
import type { CheckOptions } from "./checker.js";
import type { WorkerResponse } from "./protocol.js";

/** The part of a Worker the client needs, so that tests can pass something else. */
export interface WorkerPort {
  postMessage(message: unknown, transfer?: ArrayBuffer[]): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
}

type Pending = { resolve: (response: WorkerResponse) => void; reject: (reason: Error) => void };

/** The checker in a worker, as promises. Each request is answered by the response with its id. */
export class CheckerClient {
  private next = 1;
  private readonly pending = new Map<number, Pending>();

  constructor(private readonly port: WorkerPort) {
    port.addEventListener("message", ({ data }) => {
      const response = data as WorkerResponse;
      const waiting = this.pending.get(response.id);
      if (waiting === undefined) return;
      this.pending.delete(response.id);
      if (response.type === "error") waiting.reject(new Error(response.message));
      else waiting.resolve(response);
    });
  }

  private async send<Type extends WorkerResponse["type"]>(
    message: Record<string, unknown>,
    expected: Type,
    transfer?: ArrayBuffer[],
  ): Promise<Extract<WorkerResponse, { type: Type }>> {
    const id = this.next++;
    const response = await new Promise<WorkerResponse>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.port.postMessage({ ...message, id }, transfer);
    });
    if (response.type !== expected) throw new Error(`expected ${expected}, got ${response.type}`);
    return response as Extract<WorkerResponse, { type: Type }>;
  }

  /** The bytes move to the worker, and are gone from here afterwards. */
  async load(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
    return (await this.send({ type: "load", bytes }, "loaded", [bytes.buffer])).lang;
  }

  async check(text: string, options?: CheckOptions): Promise<Finding[]> {
    return (await this.send({ type: "check", text, options }, "findings")).findings;
  }

  async fixSafe(text: string, options?: CheckOptions): Promise<string> {
    return (await this.send({ type: "fixSafe", text, options }, "fixed")).text;
  }

  async suggest(word: string, lang: Variety): Promise<string[]> {
    return (await this.send({ type: "suggest", word, lang }, "suggestions")).words;
  }

  async complete(prefix: string, lang: Variety, limit?: number): Promise<Completion[]> {
    return (await this.send({ type: "complete", prefix, lang, limit }, "completions")).completions;
  }
}
