import type { Variety } from "@zimanyar/rules";

type Mode = Variety | "auto";

/** The browser never sends what follows the # to a server, so a shared link keeps the text between people. */
const LIMIT = 20_000;

const toBase64Url = (text: string): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (value: string): string =>
  new TextDecoder("utf-8", { fatal: true }).decode(
    Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0)),
  );

export function writeShared(text: string, mode: Mode): string {
  return `#${new URLSearchParams({ lang: mode, t: toBase64Url(text.slice(0, LIMIT)) })}`;
}

/** What a link holds. A broken or foreign fragment is simply no text, as it can come from anywhere. */
export function readShared(hash: string): { text: string; mode: Mode } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const encoded = params.get("t");
  if (encoded === null) return null;
  try {
    const mode = params.get("lang");
    return {
      text: fromBase64Url(encoded).slice(0, LIMIT),
      mode: mode === "ckb" || mode === "kmr" ? mode : "auto",
    };
  } catch {
    return null;
  }
}
