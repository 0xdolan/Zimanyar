import "@zimanyar/app/page.css";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { applyInterface } from "@zimanyar/app";
import overlayCss from "@zimanyar/app/overlay.css?inline";
import { CheckerPanel, type EditorBackend, pronunciationOf } from "@zimanyar/editor";
import { createT } from "@zimanyar/i18n";
import { checkOptionsFrom, type Settings } from "@zimanyar/settings";
import { Button } from "@zimanyar/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { backendFor, onLexiconLoaded } from "./engine";
import { isNative } from "./native";
import { loadSettings, onSettingsChanged } from "./platform";

/** The clipboard, in a browser test, is what the test put here. */
const clipboard = {
  read: async () =>
    isNative() ? await readText().catch(() => "") : (sessionStorage.getItem("clipboard") ?? ""),
  write: async (text: string) => {
    if (isNative()) await writeText(text);
    else sessionStorage.setItem("clipboard", text);
  },
};

const hide = () => (isNative() ? getCurrentWindow().hide() : Promise.resolve());

/** Press the shortcut, fix what the clipboard holds, and put it back to paste. */
function QuickCheck({ settings }: { settings: Settings }) {
  const t = createT(settings.interface.uiLang);
  const [text, setText] = useState<string | null>(null);
  const [turn, setTurn] = useState(0);
  const current = useRef(settings);
  current.current = settings;
  const backend = useMemo<EditorBackend>(() => backendFor(() => current.current), []);
  const options = checkOptionsFrom(settings);

  const load = useCallback(async () => {
    setText(await clipboard.read());
    setTurn((value) => value + 1);
  }, []);

  useEffect(() => {
    void load();
    if (isNative()) void listen("check-clipboard", () => void load());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") void hide();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [load]);

  const onReady = useCallback((refresh: () => void) => onLexiconLoaded(refresh), []);

  if (text === null) return null;
  return (
    <main className="flex min-h-screen flex-col gap-3 p-3">
      <h1 className="text-lg font-semibold">{t("desktop.quickCheck")}</h1>
      {text.trim() === "" && <p className="text-muted-foreground">{t("desktop.clipboardEmpty")}</p>}
      <CheckerPanel
        actions={(field) => (
          <Button
            onClick={() => {
              void clipboard.write(field.get()).then(hide);
            }}
            size="sm"
          >
            {t("desktop.copyBack")}
          </Button>
        )}
        backend={backend}
        css={overlayCss}
        initialMode={options.lang}
        initialText={text}
        {...(settings.teaching.mode && settings.teaching.ipa ? { ipaOf: pronunciationOf } : {})}
        soraniMarks={settings.autocomplete.soraniMarks}
        typingHelper={settings.autocomplete.typingHelper}
        key={turn}
        lang={settings.interface.uiLang}
        noSamples
        onReady={onReady}
      />
    </main>
  );
}

const mount = createRoot(document.getElementById("root") as HTMLElement);
const draw = (settings: Settings) => {
  applyInterface(settings);
  mount.render(<QuickCheck settings={settings} />);
};
void loadSettings().then(draw);
onSettingsChanged(draw);
