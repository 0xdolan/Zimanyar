# The desktop app

`apps/desktop` is a [Tauri](https://tauri.app/) v2 shell around `@zimanyar/app`, the same app as the extension's full view. Rust holds the windows, the tray, the global shortcut and one settings file, and nothing about Kurdish.

```sh
make data             # the lexicons
make desktop-docker   # build and check the packages in a container, with nothing installed on your system
make desktop-smoke    # install the .deb in a clean container, start it on a virtual screen, and save a screenshot
```

To work on it directly, install the [Tauri prerequisites](https://tauri.app/start/prerequisites/) and run `pnpm --filter @zimanyar/desktop tauri dev`.

## What runs where

| part | where |
| --- | --- |
| checker | a Web Worker in each window, as on the website |
| lexicons | files inside the app, read by one `fetch` that the policy keeps inside it |
| settings | `$XDG_CONFIG_HOME/zimanyar/settings.json`, written atomically by Rust and validated by `@zimanyar/settings` when read |
| clipboard | only the quick window, in its capability |
| files | only what someone chose in a dialog, which is what grows the file scope, or dropped on the window |

## Windows

The **main** window closes the app. The **quick** window starts hidden. `Ctrl+Alt+K` or the tray's menu shows it with the clipboard's text: fix what it finds, then copy it back to paste.

Global shortcuts need X11 or XWayland, and the tray needs a desktop that shows one. On a pure Wayland session or a desktop without a tray the app says so on stderr and carries on, and the main window has everything but the shortcut.

## Packages

`tauri build` makes the `.deb`, `.rpm` and AppImage. The AppImage step downloads `linuxdeploy` from its rolling `continuous` release, which Tauri does not let us pin, so a release should treat that package with less trust than the other two. `packaging/linux/` holds the desktop entry, AppStream metadata, man page and Debian copyright and changelog, and `check-package.sh` runs lintian, `appstreamcli` and `desktop-file-validate` on a `.deb`. `packaging/flatpak/` has a starting manifest for a later Flathub submission, and has never been built.

## Tests

- `scripts/screenshots/desktop.spec.ts` runs the app's pages in a browser, without the shell, where `native.ts` keeps settings in `localStorage` and the quick window's clipboard in `sessionStorage`.
- `packaging/linux/smoke-test.sh` runs the installed app on a virtual screen. It shows that the app starts and draws, then goes through the quick check for real: the shortcut, the clipboard, the fix, and the corrected text back on the clipboard. It does not use the tray or the file dialogs.
