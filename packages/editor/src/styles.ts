/**
 * The underlines. Shape says what kind of finding it is, so colour never has to. Everything is CSS,
 * because a page's content security policy may refuse images.
 */
export const OVERLAY_CSS = `
.zy-root { font-family: var(--font-sans, sans-serif); line-height: var(--leading-latin, 1.5); color: var(--foreground, inherit); }
.zy-clip { position: fixed; overflow: hidden; pointer-events: none; }
.zy-underline { position: absolute; height: 3px; box-sizing: border-box; }
.zy-spelling { border-block-end: 2px solid var(--destructive, #d7263d); }
.zy-warning { border-block-end: 2px dotted var(--warning, #b45309); }
.zy-hint { border-block-end: 2px dashed var(--hint, #1d4ed8); }
.zy-error {
  --zy-wave: var(--destructive, #d7263d);
  background:
    linear-gradient(135deg, transparent 40%, var(--zy-wave) 40%, var(--zy-wave) 60%, transparent 60%) 0 0 / 6px 3px repeat-x,
    linear-gradient(45deg, transparent 40%, var(--zy-wave) 40%, var(--zy-wave) 60%, transparent 60%) 3px 0 / 6px 3px repeat-x;
}
.zy-floating { position: fixed; pointer-events: auto; max-width: min(24rem, calc(100vw - 16px)); max-height: calc(100vh - 16px); overflow: auto; }
.zy-badge {
  position: fixed; pointer-events: auto; min-width: 1.5rem; height: 1.5rem; padding-inline: 0.375rem;
  border: 0; border-radius: 9999px; font: 600 0.75rem/1.5rem var(--font-sans, sans-serif); cursor: pointer;
  background: var(--destructive, #d7263d); color: var(--destructive-foreground, #fff);
}
.zy-sr {
  position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}
`;

const HOISTED = /@(?:font-face|property)[^{}@]*\{[^{}]*\}/g;
const ROOT = /:root((?:\[[^\]]*\]|:not\([^)]*\))*)/g;

/**
 * Split a stylesheet for use in a shadow root, where `:root` matches nothing, and where `@font-face` and
 * `@property` have no effect: those two only work in the document, so they go there.
 */
export function splitStyles(css: string): { shadow: string; document: string } {
  const hoisted = css.match(HOISTED) ?? [];
  const shadow = css
    .replace(HOISTED, "")
    .replace(ROOT, (_match, states: string) => (states === "" ? ":host" : `:host(${states})`));
  return { shadow, document: hoisted.join("\n") };
}

/** Add a stylesheet to a document or shadow root, and return how to take it away. */
export function addStyles(target: Document | ShadowRoot, css: string): () => void {
  if (css === "") return () => {};
  // Unlike a style element, a constructed sheet is allowed under a strict content security policy.
  if ("adoptedStyleSheets" in target && typeof CSSStyleSheet.prototype.replaceSync === "function") {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
    return () => {
      target.adoptedStyleSheets = target.adoptedStyleSheets.filter((other) => other !== sheet);
    };
  }
  const owner = target instanceof ShadowRoot ? target.ownerDocument : target;
  const style = owner.createElement("style");
  style.textContent = css;
  (target instanceof ShadowRoot ? target : owner.head).append(style);
  return () => style.remove();
}
