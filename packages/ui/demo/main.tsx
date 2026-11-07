import { Checker } from "@zimanyar/checker";
import { createT, dirOf, type UiLang } from "@zimanyar/i18n";
import type { Finding, Variety } from "@zimanyar/rules";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { AutocompleteList, FindingCard, FindingsPanel } from "../src/index.js";
import "../src/styles.css";

const params = new URLSearchParams(location.search);
const lang = (params.get("lang") ?? "en") as UiLang;
const theme = params.get("theme") ?? "light";
const text: Record<Variety, string> = {
  kmr: "Min tu dîtim. Ez dıçım malê. Ez nazanim.",
  ckb: "دەرگاەکە کرایەوە. من نان خواردم. ئەو رۆژە هات.",
};
const variety: Variety = lang === "ckb" ? "ckb" : "kmr";
const sample = text[variety];

document.documentElement.dataset["theme"] = theme;
document.documentElement.lang = lang;
document.documentElement.dir = dirOf(lang);

function Demo() {
  const t = createT(lang);
  const findings = new Checker().check(sample, { lang: variety });
  const [selected, setSelected] = useState<Finding | null>(findings[0] ?? null);
  return (
    <main className="flex flex-wrap items-start gap-6 p-4 sm:p-6">
      <h1 className="sr-only">{t("autocomplete.label")}</h1>
      <div className="flex flex-col gap-4">
        <p className="max-w-prose text-xl">{sample}</p>
        <FindingsPanel
          findings={findings}
          lang={lang}
          onSelect={setSelected}
          selectedId={selected?.id ?? null}
          textOf={(finding) => sample.slice(finding.range.start, finding.range.end)}
        />
      </div>
      {selected && (
        <FindingCard
          finding={selected}
          ipaOf={() => "diːtiː"}
          lang={lang}
          onAddToDictionary={() => {}}
          onClose={() => {}}
          onIgnore={() => {}}
          onLearn={() => {}}
        />
      )}
      {selected && (
        <FindingCard
          finding={selected}
          lang={lang}
          onClose={() => {}}
          onIgnore={() => {}}
          onLearn={() => {}}
          variant="compact"
        />
      )}
      <AutocompleteList
        activeIndex={1}
        id="words"
        items={[
          { word: variety === "ckb" ? "کتێب" : "kitêb", attested: true },
          { word: variety === "ckb" ? "کتێبەکە" : "kitêba", attested: true },
          { word: variety === "ckb" ? "کتێبەکانم" : "kitêbên", attested: false },
        ]}
        lang={lang}
        onSelect={() => {}}
      />
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
