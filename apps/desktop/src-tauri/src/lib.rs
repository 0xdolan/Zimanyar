//! A thin shell. Everything Zimanyar knows lives in the TypeScript packages: this holds the windows, the tray,
//! the shortcut, a settings file and a file of practice.

use std::{fs, path::PathBuf};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

const SHORTCUT: &str = "Ctrl+Alt+K";
/// Settings are small. Anything bigger is not settings.
const MAX_SETTINGS_BYTES: usize = 1024 * 1024;
/// Spaced repetition remembers every drill answered, which is more than settings, and still bounded.
const MAX_PRACTICE_BYTES: usize = 4 * 1024 * 1024;

fn data_file(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let config = app.path().config_dir().map_err(|error| error.to_string())?;
    Ok(config.join("zimanyar").join(name))
}

fn load(app: &AppHandle, name: &str) -> Result<Option<String>, String> {
    match fs::read_to_string(data_file(app, name)?) {
        Ok(text) => Ok(Some(text)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn save(app: &AppHandle, name: &str, json: String, max: usize) -> Result<(), String> {
    if json.len() > max {
        return Err(format!("{name} too large"));
    }
    serde_json::from_str::<serde_json::Value>(&json).map_err(|error| error.to_string())?;
    let file = data_file(app, name)?;
    let folder = file.parent().ok_or("no data folder")?;
    fs::create_dir_all(folder).map_err(|error| error.to_string())?;
    // Written beside it and moved into place, so that a crash cannot leave half a file.
    let partial = file.with_extension("json.partial");
    fs::write(&partial, json).map_err(|error| error.to_string())?;
    fs::rename(&partial, &file).map_err(|error| error.to_string())
}

fn clear(app: &AppHandle, name: &str) -> Result<(), String> {
    match fs::remove_file(data_file(app, name)?) {
        Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(error.to_string()),
        _ => Ok(()),
    }
}

#[tauri::command]
fn load_settings(app: AppHandle) -> Result<Option<String>, String> {
    load(&app, "settings.json")
}

#[tauri::command]
fn save_settings(app: AppHandle, json: String) -> Result<(), String> {
    save(&app, "settings.json", json, MAX_SETTINGS_BYTES)
}

#[tauri::command]
fn clear_settings(app: AppHandle) -> Result<(), String> {
    clear(&app, "settings.json")
}

#[tauri::command]
fn load_practice(app: AppHandle) -> Result<Option<String>, String> {
    load(&app, "practice.json")
}

#[tauri::command]
fn save_practice(app: AppHandle, json: String) -> Result<(), String> {
    save(&app, "practice.json", json, MAX_PRACTICE_BYTES)
}

#[tauri::command]
fn clear_practice(app: AppHandle) -> Result<(), String> {
    clear(&app, "practice.json")
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// The quick window reads the clipboard itself, when told to.
fn check_clipboard(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("quick") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("check-clipboard", ());
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Open Zimanyar", true, None::<&str>)?;
    let check = MenuItem::with_id(app, "check", "Check the clipboard", true, Some(SHORTCUT))?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &check, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .tooltip("Zimanyar");
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.on_menu_event(|app, event| match event.id.as_ref() {
        "show" => show_main(app),
        "check" => check_clipboard(app),
        "quit" => app.exit(0),
        _ => {}
    })
    .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app)
        }))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        check_clipboard(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            clear_settings,
            load_practice,
            save_practice,
            clear_practice
        ])
        .setup(|app| {
            // Neither of these is there on every desktop: Wayland has no global shortcuts, and some
            // desktops no tray. The main window works without them.
            if let Err(error) = app.global_shortcut().register(SHORTCUT) {
                eprintln!("no global shortcut: {error}");
            }
            if let Err(error) = build_tray(app.handle()) {
                eprintln!("no tray icon: {error}");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("the app could not start");
}
