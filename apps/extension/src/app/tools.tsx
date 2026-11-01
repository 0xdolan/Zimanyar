import { createT, type UiLang } from "@zimanyar/i18n";
import { useState } from "react";
import { pronounce, transliterate } from "../lib/writing";

/** The other script and the pronunciation of any text. */
export function Tools({ lang }: { lang: UiLang }) {
  const t = createT(lang);
  const [text, setText] = useState("");
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <label className="flex flex-col gap-1">
        {t("editor.text")}
        <textarea
          className="border-input bg-background min-h-32 rounded-lg border p-3 text-lg"
          dir="auto"
          onChange={(event) => setText(event.target.value)}
          value={text}
        />
      </label>
      {text.trim() !== "" && (
        <dl className="flex flex-col gap-3">
          <div>
            <dt className="font-semibold">{t("tools.otherScript")}</dt>
            <dd dir="auto">{transliterate(text)}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t("tools.ipa")}</dt>
            <dd className="font-mono" dir="ltr">
              {pronounce(text)}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
