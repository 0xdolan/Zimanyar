// A release build opens no terminal window on any system.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    zimanyar_desktop_lib::run();
}
