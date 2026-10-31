import { Checker } from "@zimanyar/checker";
import { createT, dirOf, type UiLang } from "@zimanyar/i18n";
import type { Variety } from "@zimanyar/rules";
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { attachEditor, type EditorBackend } from "../src/index.js";
import "./styles.css";
import css from "./styles.css?inline";

const params = new URLSearchParams(location.search);
const lang = (params.get("lang") ?? "en") as UiLang;
const theme = (params.get("theme") ?? "light") as "light" | "dark";
const shadow = (params.get("shadow") ?? "open") as ShadowRootMode;
const variety: Variety = lang === "ckb" ? "ckb" : "kmr";

const SAMPLE: Record<Variety, string> = {
  kmr: "Min tu dîtim. Ez dıçım malê. Ez ez nazanim û ev nivîsek dirêj e ku li ser çend rêzan belav dibe da ku xêz li her rêzê rast be.",
  ckb: "دەرگاەکە کرایەوە. ئەو رۆژە هات. من من نان خواردم و ئەمە نووسینێکی درێژە کە بەسەر چەند دێڕێکدا بڵاو دەبێتەوە.",
};
const WORDS: Record<Variety, string[]> = {
  kmr: ["kitêb", "kitêba", "kitêbên", "kitêbxane"],
  ckb: ["کتێب", "کتێبەکە", "کتێبەکان", "کتێبخانە"],
};

const checker = new Checker();
const backend: EditorBackend = {
  check: async (text, options) => checker.check(text, options),
  suggest: async () => [],
  complete: async (prefix, language) =>
    WORDS[language].filter((word) => word.startsWith(prefix)).map((word) => ({ word, attested: true })),
};

document.documentElement.dataset["theme"] = theme;
document.documentElement.lang = lang;
document.documentElement.dir = dirOf(lang);

const FIELD =
  "border-input bg-background w-full rounded-md border p-3 text-xl leading-relaxed focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

window.editors = {};

function useEditor<Field extends HTMLElement>(name: string) {
  const ref = useRef<Field>(null);
  useEffect(() => {
    if (ref.current === null) return;
    const handle = attachEditor(ref.current, { backend, uiLang: lang, css, theme, shadow, lang: variety });
    if (handle === null) return;
    window.editors[name] = handle;
    return () => handle.destroy();
  }, [name]);
  return ref;
}

function Demo() {
  const t = createT(lang);
  const textarea = useEditor<HTMLTextAreaElement>("textarea");
  const editable = useEditor<HTMLDivElement>("editable");
  const input = useEditor<HTMLInputElement>("input");
  return (
    <main className="flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-lg font-semibold">{t("editor.text")}</h1>
      <textarea
        aria-label={t("editor.text")}
        className={FIELD}
        defaultValue={SAMPLE[variety]}
        dir="auto"
        id="textarea"
        ref={textarea}
        rows={5}
      />
      {/* biome-ignore lint/a11y/useSemanticElements: a contenteditable element is what is being tested */}
      <div
        aria-label={t("editor.text")}
        aria-multiline="true"
        className={FIELD}
        contentEditable
        dir="auto"
        id="editable"
        ref={editable}
        role="textbox"
        suppressContentEditableWarning
        tabIndex={0}
      >
        {SAMPLE[variety]}
      </div>
      <input
        aria-label={t("editor.text")}
        className={FIELD}
        defaultValue={SAMPLE[variety].slice(0, 28)}
        dir="auto"
        id="input"
        ref={input}
        type="text"
      />
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<Demo />);
