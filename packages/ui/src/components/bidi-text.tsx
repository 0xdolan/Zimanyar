import { splitBidi } from "../lib/bidi.js";

/**
 * Text that may mix scripts. Each run gets its own direction and language, so Kurdish inside an
 * English sentence reads correctly, and the other way round. It only ever renders text nodes.
 */
export function BidiText({ text }: { text: string }) {
  return (
    <>
      {splitBidi(text).map((run, index) =>
        run.dir === null ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: runs never reorder within a render
          <span key={index}>{run.text}</span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: runs never reorder within a render
          <bdi key={index} dir={run.dir} lang={run.dir === "rtl" ? "ckb" : undefined}>
            {run.text}
          </bdi>
        ),
      )}
    </>
  );
}
