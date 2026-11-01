import { createT, type MessageKey } from "@zimanyar/i18n";
import { parseDictionary, ruleFamilies, type Settings, withWord } from "@zimanyar/settings";
import { Button } from "@zimanyar/ui";
import { type ChangeEvent, type ReactNode, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { saveSettings } from "../lib/browser-settings";
import { matchPatternOf } from "../lib/messages";

function Section({ title, query, children }: { title: string; query: string; children: ReactNode }) {
  const [matches, setMatches] = useState(true);
  useEffect(
    () => setMatches(query === "" || title.toLowerCase().includes(query.toLowerCase())),
    [query, title],
  );
  if (!matches) return null;
  return (
    <section className="border-border flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        checked={checked}
        className="size-4"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

function Choice<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: readonly (readonly [Value, string])[];
  onChange: (value: Value) => void;
}) {
  return (
    <label className="flex flex-wrap items-center gap-2">
      <span>{label}</span>
      <select
        className="border-input bg-background min-h-9 rounded-md border px-2"
        onChange={(event) => onChange(event.target.value as Value)}
        value={value}
      >
        {options.map(([option, name]) => (
          <option key={option} value={option}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

const download = (name: string, content: string) => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
};

/** Every setting, saved as it changes. */
export function SettingsPage({ settings: stored }: { settings: Settings }) {
  // Shown at once, ahead of storage answering, so that a control never seems to ignore a click.
  const [settings, setSettings] = useState(stored);
  useEffect(() => setSettings(stored), [stored]);
  const save = (next: Settings) => {
    setSettings(next);
    return saveSettings(next);
  };
  const t = createT(settings.interface.uiLang);
  const [query, setQuery] = useState("");
  const [word, setWord] = useState("");
  const [problem, setProblem] = useState(false);
  const [commands, setCommands] = useState<{ description?: string; shortcut?: string }[]>([]);

  useEffect(() => {
    void browser.commands.getAll().then(setCommands);
  }, []);

  const change = <Group extends keyof Settings>(group: Group, values: Partial<Settings[Group]>) =>
    void save({ ...settings, [group]: { ...(settings[group] as object), ...values } });

  const toggleVariety = (variety: "ckb" | "kmr", on: boolean) =>
    change("languages", {
      enabled: on
        ? [...settings.languages.enabled, variety]
        : settings.languages.enabled.filter((item) => item !== variety),
    });

  const toggleFamily = (family: string, on: boolean) =>
    change("checking", {
      disabledFamilies: on
        ? settings.checking.disabledFamilies.filter((item) => item !== family)
        : [...settings.checking.disabledFamilies, family],
    });

  const importWords = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file === undefined) return;
    const words = parseDictionary(await file.text());
    setProblem(words === null);
    if (words !== null) await save(words.reduce(withWord, settings));
  };

  const everywhere = async (on: boolean) => {
    // Asked only here, with the reason beside it, and only when someone chooses this.
    if (on && !(await browser.permissions.request({ origins: ["<all_urls>"] }))) return;
    if (!on) await browser.permissions.remove({ origins: ["<all_urls>"] }).catch(() => {});
    change("sites", { everywhere: on });
  };

  const removeSite = async (site: string) => {
    change("sites", { enabled: settings.sites.enabled.filter((item) => item !== site) });
    await browser.permissions.remove({ origins: [matchPatternOf(site)] }).catch(() => {});
  };

  const familyName = (family: string) => t(`family.${family}` as MessageKey);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">{t("popup.settings")}</h1>
      <label className="flex flex-col gap-1">
        {t("settings.search")}
        <input
          className="border-input bg-background min-h-9 rounded-md border px-2"
          onChange={(event) => setQuery(event.target.value)}
          type="search"
          value={query}
        />
      </label>

      <Section query={query} title={t("settings.languages")}>
        <Toggle
          checked={settings.languages.enabled.includes("ckb")}
          label={t("lang.ckb")}
          onChange={(on) => toggleVariety("ckb", on)}
        />
        <Toggle
          checked={settings.languages.enabled.includes("kmr")}
          label={t("lang.kmr")}
          onChange={(on) => toggleVariety("kmr", on)}
        />
        <Toggle
          checked={settings.languages.autoDetect}
          label={t("settings.autoDetect")}
          onChange={(autoDetect) => change("languages", { autoDetect })}
        />
        <Choice
          label={t("settings.fallback")}
          onChange={(fallback) => change("languages", { fallback })}
          options={[
            ["ckb", t("lang.ckb")],
            ["kmr", t("lang.kmr")],
          ]}
          value={settings.languages.fallback}
        />
      </Section>

      <Section query={query} title={t("settings.checking")}>
        <Choice
          label={t("settings.strictness")}
          onChange={(strictness) => change("checking", { strictness })}
          options={[
            ["standard", t("settings.standard")],
            ["tolerant", t("settings.tolerant")],
          ]}
          value={settings.checking.strictness}
        />
        <Choice
          label={t("settings.minSeverity")}
          onChange={(minSeverity) => change("checking", { minSeverity })}
          options={[
            ["hint", t("severity.hint")],
            ["warning", t("severity.warning")],
            ["error", t("severity.error")],
          ]}
          value={settings.checking.minSeverity}
        />
        <fieldset className="flex flex-col gap-1">
          <legend className="font-semibold">{t("settings.families")}</legend>
          {ruleFamilies().map((family) => (
            <Toggle
              checked={!settings.checking.disabledFamilies.includes(family)}
              key={family}
              label={familyName(family)}
              onChange={(on) => toggleFamily(family, on)}
            />
          ))}
        </fieldset>
      </Section>

      <Section query={query} title={t("settings.teaching")}>
        <Toggle
          checked={settings.teaching.mode}
          label={t("settings.teachingMode")}
          onChange={(mode) => change("teaching", { mode })}
        />
        <Toggle
          checked={settings.teaching.lessonLinks}
          label={t("settings.lessonLinks")}
          onChange={(lessonLinks) => change("teaching", { lessonLinks })}
        />
      </Section>

      <Section query={query} title={t("settings.autocomplete")}>
        <Toggle
          checked={settings.autocomplete.enabled}
          label={t("settings.autocompleteOn")}
          onChange={(enabled) => change("autocomplete", { enabled })}
        />
        <Toggle
          checked={settings.autocomplete.typingHelper}
          label={t("settings.typingHelper")}
          onChange={(typingHelper) => change("autocomplete", { typingHelper })}
        />
        <label className="flex items-center gap-2">
          <span>{t("settings.count")}</span>
          <input
            className="border-input bg-background min-h-9 w-20 rounded-md border px-2"
            max={10}
            min={1}
            onChange={(event) =>
              change("autocomplete", { count: Math.min(10, Math.max(1, Number(event.target.value) || 1)) })
            }
            type="number"
            value={settings.autocomplete.count}
          />
        </label>
      </Section>

      <Section query={query} title={t("settings.dictionary")}>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (word.trim() !== "") void save(withWord(settings, word.trim()));
            setWord("");
          }}
        >
          <input
            aria-label={t("settings.addWord")}
            className="border-input bg-background min-h-9 rounded-md border px-2"
            dir="auto"
            maxLength={100}
            onChange={(event) => setWord(event.target.value)}
            value={word}
          />
          <Button size="sm" type="submit">
            {t("settings.addWord")}
          </Button>
        </form>
        <ul className="flex flex-wrap gap-2">
          {settings.dictionary.words.map((item) => (
            <li key={item}>
              <Button
                aria-label={t("settings.removeWord", { word: item })}
                onClick={() =>
                  change("dictionary", { words: settings.dictionary.words.filter((other) => other !== item) })
                }
                size="sm"
                variant="outline"
              >
                <span dir="auto">{item}</span> ×
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() =>
              download("zimanyar-dictionary.json", JSON.stringify(settings.dictionary.words, null, 1))
            }
            size="sm"
            variant="outline"
          >
            {t("settings.exportWords")}
          </Button>
          <label className="flex items-center gap-2 text-sm">
            {t("settings.importWords")}
            <input accept="application/json" onChange={(event) => void importWords(event)} type="file" />
          </label>
        </div>
        {problem && (
          <p role="alert" className="text-destructive text-sm">
            {t("settings.badFile")}
          </p>
        )}
        {settings.dictionary.ignoredRules.length > 0 && (
          <Button onClick={() => change("dictionary", { ignoredRules: [] })} size="sm" variant="ghost">
            {t("settings.resetIgnored")}
          </Button>
        )}
      </Section>

      <Section query={query} title={t("settings.sites")}>
        <p className="text-muted-foreground text-sm">{t("settings.sitesHelp")}</p>
        <Toggle
          checked={settings.sites.everywhere}
          label={t("settings.everywhere")}
          onChange={(on) => void everywhere(on)}
        />
        <ul className="flex flex-col gap-1">
          {settings.sites.enabled.map((site) => (
            <li className="flex items-center gap-2" key={site}>
              <span dir="ltr">{site}</span>
              <Button
                aria-label={t("settings.removeSite", { site })}
                onClick={() => void removeSite(site)}
                size="sm"
                variant="ghost"
              >
                ×
              </Button>
            </li>
          ))}
        </ul>
      </Section>

      <Section query={query} title={t("settings.interface")}>
        <Choice
          label={t("settings.uiLang")}
          onChange={(uiLang) => change("interface", { uiLang })}
          options={[
            ["en", t("lang.en")],
            ["ckb", t("lang.ckb")],
            ["kmr", t("lang.kmr")],
          ]}
          value={settings.interface.uiLang}
        />
        <Choice
          label={t("settings.theme")}
          onChange={(theme) => change("interface", { theme })}
          options={[
            ["system", t("starlight.themeSelect.auto")],
            ["light", t("theme.light")],
            ["dark", t("theme.dark")],
          ]}
          value={settings.interface.theme}
        />
        <Choice
          label={t("settings.underline")}
          onChange={(underline) => change("interface", { underline })}
          options={[
            ["thin", t("settings.thin")],
            ["thick", t("settings.thick")],
          ]}
          value={settings.interface.underline}
        />
        <Choice
          label={t("settings.fontSize")}
          onChange={(fontSize) => change("interface", { fontSize })}
          options={[
            ["small", t("settings.small")],
            ["normal", t("settings.normal")],
            ["large", t("settings.large")],
          ]}
          value={settings.interface.fontSize}
        />
      </Section>

      <Section query={query} title={t("settings.shortcuts")}>
        <ul className="flex flex-col gap-1">
          {commands
            .filter((command) => command.description)
            .map((command) => (
              <li className="flex justify-between gap-4" key={command.description}>
                <span>{command.description}</span>
                <kbd dir="ltr">{command.shortcut || t("settings.noShortcut")}</kbd>
              </li>
            ))}
        </ul>
        <p className="text-muted-foreground text-sm">{t("settings.shortcutsHelp")}</p>
      </Section>

      <Section query={query} title={t("privacy.title")}>
        <p>{t("privacy.lead")}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => download("zimanyar-settings.json", JSON.stringify(settings, null, 1))}
            size="sm"
            variant="outline"
          >
            {t("settings.exportAll")}
          </Button>
          <Button onClick={() => void browser.storage.local.clear()} size="sm" variant="destructive">
            {t("settings.clearAll")}
          </Button>
        </div>
      </Section>

      <Section query={query} title={t("about.title")}>
        <p dir="ltr">Zimanyar {browser.runtime.getManifest().version}</p>
        <p>{t("about.lead")}</p>
        <p dir="ltr">GPL-3.0-or-later · CC BY-SA 4.0</p>
      </Section>
    </main>
  );
}
