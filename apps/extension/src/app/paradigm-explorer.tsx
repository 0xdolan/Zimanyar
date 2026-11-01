import { type Course, nounsOf, referenceVerbs, verbSections } from "@zimanyar/content";
import { NounForms, VerbInfo, VerbOtherForms, VerbTable } from "@zimanyar/content/components";
import { createT, type UiLang } from "@zimanyar/i18n";
import { useState } from "react";

/** Choose a verb to see every tense, or a noun to see every form. */
export function ParadigmExplorer({ lang }: { lang: UiLang }) {
  const t = createT(lang);
  const [course, setCourse] = useState<Course>(lang === "kmr" ? "kmr" : "ckb");
  const [verb, setVerb] = useState(referenceVerbs(course)[0] as string);
  const [noun, setNoun] = useState(nounsOf(course)[0] as string);
  const choose = (next: Course) => {
    setCourse(next);
    setVerb(referenceVerbs(next)[0] as string);
    setNoun(nounsOf(next)[0] as string);
  };
  const select = "border-input bg-background min-h-9 rounded-md border px-2";
  return (
    <div className="zy-lesson flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {t("check.language")}
          <select
            className={select}
            onChange={(event) => choose(event.target.value as Course)}
            value={course}
          >
            <option value="ckb">{t("lang.ckb")}</option>
            <option value="kmr">{t("lang.kmr")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("nav.verbs")}
          <select className={select} onChange={(event) => setVerb(event.target.value)} value={verb}>
            {referenceVerbs(course).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("nav.nouns")}
          <select className={select} onChange={(event) => setNoun(event.target.value)} value={noun}>
            {nounsOf(course).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <div lang="en" dir="ltr">
        <VerbInfo lang={course} verb={verb} />
        {verbSections(course, verb).map(({ title, cells }) => (
          <section key={title}>
            <h2>{title}</h2>
            <VerbTable cells={cells.join(",")} lang={course} noCaption show="translit,ipa" verb={verb} />
          </section>
        ))}
        <VerbOtherForms lang={course} verb={verb} />
        <h2>{noun}</h2>
        <NounForms lang={course} noun={noun} />
      </div>
    </div>
  );
}
