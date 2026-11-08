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
| practice | `$XDG_CONFIG_HOME/zimanyar/practice.json`, the same way, validated by `@zimanyar/practice` when read |
| clipboard | only the quick window, in its capability |
| files | only what someone chose in a dialog, which is what grows the file scope, or dropped on the window |

## Windows

The **main** window closes the app. The **quick** window starts hidden. `Ctrl+Alt+K` or the tray's menu shows it with the clipboard's text: fix what it finds, then copy it back to paste.

Global shortcuts need X11 or XWayland, and the tray needs a desktop that shows one. On a pure Wayland session or a desktop without a tray the app says so on stderr and carries on, and the main window has everything but the shortcut.

## Packages

`tauri build` makes the `.deb`, `.rpm` and AppImage. The AppImage step downloads `linuxdeploy` from its rolling `continuous` release, which Tauri does not let us pin, so a release should treat that package with less trust than the other two. `packaging/linux/` holds the desktop entry, AppStream metadata, man page and Debian copyright and changelog, and `check-package.sh` runs lintian, `appstreamcli` and `desktop-file-validate` on a `.deb`.

## Advisories

`src-tauri/osv-scanner.toml` lists Rust advisories that come through Tauri 2's Linux dependencies and have no version to upgrade to, each with its reason and a date to look again.

## Tests

- `scripts/screenshots/desktop.spec.ts` runs the app's pages in a browser, without the shell, where `native.ts` keeps settings in `localStorage` and the quick window's clipboard in `sessionStorage`.
- `packaging/linux/smoke-test.sh` runs the installed app on a virtual screen. It shows that the app starts and draws, then goes through the quick check for real: the shortcut, the clipboard, the fix, and the corrected text back on the clipboard. It does not use the tray or the file dialogs.

## Where the packages run

The packages CI built for 0.1.0 passed `smoke-test.sh` on Ubuntu 24.04 and 26.04, Debian 12 and 13 (`.deb`) and Fedora 43 (`.rpm`). The binary needs glibc 2.34 or later. It also names two glibc 2.39 functions, `pidfd_spawnp` and `pidfd_getpid`, but Rust's standard library binds those weakly and does without them, so on Debian 12 (glibc 2.36) the loader prints a warning about a weak version and the app runs normally.

The AppImage carries GTK and WebKit but, like every AppImage made with `linuxdeploy`, leaves out what any graphical desktop already has: X11 and xcb, Wayland, GL, EGL and GLES, `libdrm`, `libgbm`, fontconfig, freetype, harfbuzz, fribidi and expat. It passed on Ubuntu 24.04 with only those libraries installed and no GTK or WebKit from the distribution.
