import { Lexicon } from "./lexicon.js";

const isGzip = (bytes: Uint8Array): boolean => bytes[0] === 0x1f && bytes[1] === 0x8b;

/** Gunzip with the platform's own stream, which browsers, workers, Node and Tauri all have. */
async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const body = new Blob([bytes.slice()]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(body).arrayBuffer());
}

/** Read a lexicon from the bytes of a packed file, gzipped or not. Surfaces supply the bytes. */
export async function loadLexicon(bytes: Uint8Array): Promise<Lexicon> {
  return new Lexicon(isGzip(bytes) ? await gunzip(bytes) : bytes);
}
