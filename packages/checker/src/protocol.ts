import { Lexicon } from "@zimanyar/data";
import { z } from "zod";
import { Checker, fixAllSafe } from "./checker.js";

const options = z.object({
  lang: z.enum(["ckb", "kmr", "auto"]).optional(),
  strictness: z.enum(["standard", "tolerant"]).optional(),
  disabledRules: z.array(z.string()).optional(),
});

/** Every message to the worker is validated: the page or content script that sends it is not trusted. */
export const requestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("load"), id: z.number(), bytes: z.instanceof(Uint8Array) }),
  z.object({ type: z.literal("check"), id: z.number(), text: z.string(), options: options.optional() }),
  z.object({ type: z.literal("fixSafe"), id: z.number(), text: z.string(), options: options.optional() }),
]);
export type WorkerRequest = z.infer<typeof requestSchema>;

export type WorkerResponse =
  | { type: "loaded"; id: number; lang: string }
  | { type: "findings"; id: number; findings: ReturnType<Checker["check"]> }
  | { type: "fixed"; id: number; text: string }
  | { type: "error"; id: number; message: string };

type Options = NonNullable<Extract<WorkerRequest, { type: "check" }>["options"]>;

/** Without exactOptionalPropertyTypes' undefineds: zod's optional keys may hold undefined. */
function cleanOptions(input: Options | undefined) {
  return {
    ...(input?.lang !== undefined ? { lang: input.lang } : {}),
    ...(input?.strictness !== undefined ? { strictness: input.strictness } : {}),
    ...(input?.disabledRules !== undefined ? { disabledRules: input.disabledRules } : {}),
  };
}

/** The worker's behaviour, without the worker: one request in, one response out. */
export function createHandler(
  checker = new Checker(),
  readLexicon: (bytes: Uint8Array) => Promise<Lexicon> | Lexicon = (bytes) => new Lexicon(bytes),
): (message: unknown) => Promise<WorkerResponse> {
  return async (message) => {
    const parsed = requestSchema.safeParse(message);
    if (!parsed.success) {
      const id = typeof (message as { id?: unknown })?.id === "number" ? (message as { id: number }).id : -1;
      return { type: "error", id, message: "invalid request" };
    }
    const request = parsed.data;
    try {
      switch (request.type) {
        case "load": {
          const lexicon = await readLexicon(request.bytes);
          checker.setLexicon(lexicon);
          return { type: "loaded", id: request.id, lang: lexicon.lang };
        }
        case "check":
          return {
            type: "findings",
            id: request.id,
            findings: checker.check(request.text, cleanOptions(request.options)),
          };
        case "fixSafe":
          return {
            type: "fixed",
            id: request.id,
            text: fixAllSafe(checker, request.text, cleanOptions(request.options)),
          };
      }
    } catch (error) {
      return { type: "error", id: request.id, message: error instanceof Error ? error.message : "failed" };
    }
  };
}
