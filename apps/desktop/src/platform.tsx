import { emit, listen } from "@tauri-apps/api/event";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { Platform } from "@zimanyar/app";
import overlayCss from "@zimanyar/app/overlay.css?inline";
import { createT, type UiLang } from "@zimanyar/i18n";
import { parseSettings, type Settings } from "@zimanyar/settings";
import { Button } from "@zimanyar/ui";
import { useEffect, useRef, useState } from "react";
import { backendFor } from "./engine";
import { baseName, chooseDropped, TEXT_EXTENSIONS } from "./lib/text-files";
import { isNative, readSettings, removeSettings, writeSettings } from "./native";

const SETTINGS_EVENT = "settings-changed";

export const loadSettings = async (): Promise<Settings> => parseSettings(await readSettings());

/** Tell every window, as the main window and the quick window each hold a copy. */
async function saveSettings(settings: Settings): Promise<void> {
  await writeSettings(settings);
  if (isNative()) await emit(SETTINGS_EVENT, settings);
  else window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: settings }));
}

export function onSettingsChanged(listener: (settings: Settings) => void): void {
  if (isNative()) void listen<unknown>(SETTINGS_EVENT, (event) => listener(parseSettings(event.payload)));
  else
    window.addEventListener(SETTINGS_EVENT, (event) =>
      listener(parseSettings((event as CustomEvent).detail)),
    );
}

const FILTERS = [{ name: "Text", extensions: TEXT_EXTENSIONS }];

/** Open, save and drop files. Only a file someone chose in a dialog can be read or written. */
function FileActions({ text, lang }: { text: { get(): string; set(value: string): void }; lang: UiLang }) {
  const t = createT(lang);
  const [path, setPath] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const latest = useRef(text);
  latest.current = text;

  const open = async () => {
    const chosen = await openDialog({ multiple: false, directory: false, filters: FILTERS });
    if (typeof chosen !== "string") return;
    latest.current.set(await readTextFile(chosen));
    setPath(chosen);
    setProblem(null);
  };

  const saveAs = async () => {
    const chosen = await saveDialog({ filters: FILTERS, ...(path !== null ? { defaultPath: path } : {}) });
    if (chosen === null) return;
    await writeTextFile(chosen, latest.current.get());
    setPath(chosen);
  };

  const save = async () => {
    if (path === null) await saveAs();
    else await writeTextFile(path, latest.current.get());
  };

  useEffect(() => {
    const over = (event: DragEvent) => event.preventDefault();
    const drop = (event: DragEvent) => {
      event.preventDefault();
      const choice = chooseDropped([...(event.dataTransfer?.files ?? [])]);
      if (choice === null) return;
      if ("problem" in choice) {
        setProblem(choice.problem === "kind" ? t("desktop.wrongKind") : t("desktop.tooBig"));
        return;
      }
      void choice.file.text().then((content) => {
        latest.current.set(content);
        // A dropped file gives no path, so that saving it asks where.
        setPath(null);
        setProblem(null);
      });
    };
    addEventListener("dragover", over);
    addEventListener("drop", drop);
    return () => {
      removeEventListener("dragover", over);
      removeEventListener("drop", drop);
    };
  }, [t]);

  return (
    <>
      {isNative() && (
        <>
          <Button onClick={() => void open()} size="sm" variant="outline">
            {t("desktop.open")}
          </Button>
          <Button onClick={() => void save()} size="sm" variant="outline">
            {t("desktop.save")}
          </Button>
          <Button onClick={() => void saveAs()} size="sm" variant="outline">
            {t("desktop.saveAs")}
          </Button>
        </>
      )}
      {path !== null && (
        <span className="text-muted-foreground text-sm" dir="ltr">
          {baseName(path)}
        </span>
      )}
      {problem !== null && (
        <span className="text-destructive text-sm" role="alert">
          {problem}
        </span>
      )}
    </>
  );
}

/** The desktop app's side of the shared app. */
export function platformFor(lang: UiLang): Platform {
  return {
    backend: (settings) => backendFor(settings),
    overlayCss,
    version: __APP_VERSION__,
    saveSettings,
    clearData: async () => {
      await removeSettings();
      await saveSettings(parseSettings({}));
    },
    openSettings: () => {
      location.href = "/settings.html";
    },
    // The app opens nothing outside itself. A link to the source is only text to copy.
    openExternal: () => {},
    takePendingText: async () => null,
    shortcuts: async () => [{ description: createT(lang)("desktop.quickCheck"), shortcut: "Ctrl+Alt+K" }],
    checkerActions: (text) => <FileActions lang={lang} text={text} />,
  };
}
