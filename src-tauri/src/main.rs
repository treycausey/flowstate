#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;

use db::{Dump, Plant, PlantCheck, Reading, Settings, StockEvent, StockGroup, Tank};
use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use tauri::{CustomMenuItem, Manager, Menu, State, Submenu};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    db_path: PathBuf,
}

fn open_conn(path: &PathBuf) -> Result<Connection, String> {
    Connection::open(path).map_err(|e| e.to_string())
}

fn conn(state: &State<AppState>) -> Result<Connection, String> {
    open_conn(&state.db_path)
}

#[tauri::command]
fn sqlite_list_tanks(state: State<AppState>) -> Result<Vec<Tank>, String> {
    db::list_tanks(&conn(&state)?).map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_create_tank(
    state: State<AppState>,
    name: String,
    reminder_cadence: Option<i64>,
) -> Result<Tank, String> {
    db::create_tank(
        &conn(&state)?,
        name,
        reminder_cadence,
        Uuid::new_v4().to_string(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_rename_tank(state: State<AppState>, id: String, name: String) -> Result<(), String> {
    db::rename_tank(&conn(&state)?, &id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_archive_tank(state: State<AppState>, id: String) -> Result<(), String> {
    db::archive_tank(&conn(&state)?, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_set_tank_reminder_cadence(
    state: State<AppState>,
    id: String,
    days: Option<i64>,
) -> Result<(), String> {
    db::set_tank_reminder_cadence(&conn(&state)?, &id, days).map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_set_tank_volume(
    state: State<AppState>,
    id: String,
    volume_l: Option<f64>,
) -> Result<(), String> {
    db::set_tank_volume(&conn(&state)?, &id, volume_l).map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_add_reading(state: State<AppState>, reading: Reading) -> Result<Reading, String> {
    db::add_reading(&conn(&state)?, &reading).map_err(|e| e.to_string())?;
    Ok(reading)
}

#[tauri::command]
fn sqlite_update_reading(state: State<AppState>, reading: Reading) -> Result<(), String> {
    db::update_reading(&conn(&state)?, &reading).map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_delete_reading(state: State<AppState>, id: String) -> Result<(), String> {
    db::delete_reading(&conn(&state)?, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_list_readings_by_tank(
    state: State<AppState>,
    tank_id: String,
) -> Result<Vec<Reading>, String> {
    db::list_readings_by_tank(&conn(&state)?, &tank_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_list_readings_by_tank_in_range(
    state: State<AppState>,
    tank_id: String,
    from_iso: String,
    to_iso: String,
) -> Result<Vec<Reading>, String> {
    db::list_readings_by_tank_in_range(&conn(&state)?, &tank_id, &from_iso, &to_iso)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_list_plants_by_tank(
    state: State<AppState>,
    tank_id: String,
) -> Result<Vec<Plant>, String> {
    db::list_plants_by_tank(&conn(&state)?, &tank_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_add_plant(state: State<AppState>, plant: Plant) -> Result<Plant, String> {
    db::add_plant(&conn(&state)?, &plant).map_err(|e| e.to_string())?;
    Ok(plant)
}

#[tauri::command]
fn sqlite_update_plant(state: State<AppState>, plant: Plant) -> Result<(), String> {
    db::update_plant(&conn(&state)?, &plant).map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_delete_plant(state: State<AppState>, id: String) -> Result<(), String> {
    db::delete_plant(&conn(&state)?, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_list_plant_checks_by_tank(
    state: State<AppState>,
    tank_id: String,
) -> Result<Vec<PlantCheck>, String> {
    db::list_plant_checks_by_tank(&conn(&state)?, &tank_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_add_plant_check(state: State<AppState>, check: PlantCheck) -> Result<PlantCheck, String> {
    db::add_plant_check(&conn(&state)?, &check).map_err(|e| e.to_string())?;
    Ok(check)
}

#[tauri::command]
fn sqlite_list_stock_by_tank(
    state: State<AppState>,
    tank_id: String,
) -> Result<Vec<StockGroup>, String> {
    db::list_stock_by_tank(&conn(&state)?, &tank_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_add_stock(state: State<AppState>, group: StockGroup) -> Result<StockGroup, String> {
    db::add_stock(&conn(&state)?, &group).map_err(|e| e.to_string())?;
    Ok(group)
}

#[tauri::command]
fn sqlite_update_stock(state: State<AppState>, group: StockGroup) -> Result<(), String> {
    db::update_stock(&conn(&state)?, &group).map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_delete_stock(state: State<AppState>, id: String) -> Result<(), String> {
    db::delete_stock(&conn(&state)?, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_list_stock_events_by_tank(
    state: State<AppState>,
    tank_id: String,
) -> Result<Vec<StockEvent>, String> {
    db::list_stock_events_by_tank(&conn(&state)?, &tank_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn sqlite_add_stock_event(state: State<AppState>, event: StockEvent) -> Result<StockEvent, String> {
    db::add_stock_event(&conn(&state)?, &event)
}

#[tauri::command]
fn sqlite_get_settings(state: State<AppState>) -> Result<Option<Settings>, String> {
    db::get_settings(&conn(&state)?)
}

#[tauri::command]
fn sqlite_set_settings(state: State<AppState>, value: Settings) -> Result<(), String> {
    db::set_settings(&conn(&state)?, &value)
}

#[tauri::command]
fn sqlite_export_dump(state: State<AppState>) -> Result<Dump, String> {
    db::export_dump(&conn(&state)?)
}

#[tauri::command]
fn sqlite_import_dump(state: State<AppState>, dump: Dump) -> Result<(), String> {
    db::import_dump(&mut conn(&state)?, &dump)
}

fn main() {
    // Build a minimal native menu for navigation
    let nav_menu = Menu::new()
        .add_item(CustomMenuItem::new("nav_home", "Home").accelerator("CmdOrCtrl+1"))
        .add_item(CustomMenuItem::new("nav_charts", "Charts").accelerator("CmdOrCtrl+2"))
        .add_item(CustomMenuItem::new("nav_report", "Report").accelerator("CmdOrCtrl+3"))
        .add_item(CustomMenuItem::new("nav_plants", "Plants").accelerator("CmdOrCtrl+4"))
        .add_item(CustomMenuItem::new("nav_stock", "Stock").accelerator("CmdOrCtrl+5"))
        .add_item(CustomMenuItem::new("nav_settings", "Settings").accelerator("CmdOrCtrl+,"));
    let app_menu = Menu::new().add_submenu(Submenu::new("Navigate", nav_menu));

    tauri::Builder::default()
        .menu(app_menu)
        .on_menu_event(|event| {
            let target = match event.menu_item_id() {
                "nav_home" => Some("home"),
                "nav_charts" => Some("charts"),
                "nav_report" => Some("report"),
                "nav_plants" => Some("plants"),
                "nav_stock" => Some("stock"),
                "nav_settings" => Some("settings"),
                _ => None,
            };
            if let Some(payload) = target {
                let _ = event.window().emit("navigate", payload);
            }
        })
        .setup(|app| {
            let app_dir = app
                .path_resolver()
                .app_local_data_dir()
                .ok_or_else(|| "failed to resolve app data dir")?;
            fs::create_dir_all(&app_dir).map_err(|e| format!("failed to create app dir: {}", e))?;
            let db_path = app_dir.join("flowstate.db");
            let mut conn = open_conn(&db_path)?;
            db::init_schema(&mut conn).map_err(|e| e.to_string())?;
            drop(conn);
            app.manage(AppState { db_path });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            sqlite_list_tanks,
            sqlite_create_tank,
            sqlite_rename_tank,
            sqlite_archive_tank,
            sqlite_set_tank_reminder_cadence,
            sqlite_set_tank_volume,
            sqlite_add_reading,
            sqlite_update_reading,
            sqlite_delete_reading,
            sqlite_list_readings_by_tank,
            sqlite_list_readings_by_tank_in_range,
            sqlite_list_plants_by_tank,
            sqlite_add_plant,
            sqlite_update_plant,
            sqlite_delete_plant,
            sqlite_list_plant_checks_by_tank,
            sqlite_add_plant_check,
            sqlite_list_stock_by_tank,
            sqlite_add_stock,
            sqlite_update_stock,
            sqlite_delete_stock,
            sqlite_list_stock_events_by_tank,
            sqlite_add_stock_event,
            sqlite_get_settings,
            sqlite_set_settings,
            sqlite_export_dump,
            sqlite_import_dump,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
