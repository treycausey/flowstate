#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{CustomMenuItem, Manager, Menu, State, Submenu};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    db_path: PathBuf,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Tank {
    id: String,
    name: String,
    #[serde(rename = "createdAt")]
    created_at: String,
    #[serde(rename = "archivedAt")]
    archived_at: Option<String>,
    #[serde(rename = "reminderCadence")]
    reminder_cadence: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Reading {
    id: String,
    #[serde(rename = "tankId")]
    tank_id: String,
    ts: String,
    #[serde(rename = "pH")]
    p_h: f64,
    ammonia: f64,
    nitrite: f64,
    nitrate: f64,
    note: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Settings {
    units: Option<String>,
    theme: Option<String>,
    #[serde(rename = "chartOptions")]
    chart_options: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Dump {
    tanks: Vec<Tank>,
    readings: Vec<Reading>,
    settings: Option<Settings>,
}

fn open_conn(path: &PathBuf) -> rusqlite::Result<Connection> {
    Connection::open(path)
}

fn now_iso() -> String {
    let now: DateTime<Utc> = Utc::now();
    now.to_rfc3339()
}

fn init_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        r#"
    CREATE TABLE IF NOT EXISTS tanks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      archivedAt TEXT,
      reminderCadence INTEGER
    );
    CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY,
      tankId TEXT NOT NULL,
      ts TEXT NOT NULL,
      pH REAL NOT NULL,
      ammonia REAL NOT NULL,
      nitrite REAL NOT NULL,
      nitrate REAL NOT NULL,
      note TEXT,
      FOREIGN KEY(tankId) REFERENCES tanks(id)
    );
    CREATE INDEX IF NOT EXISTS readings_by_tank ON readings(tankId);
    CREATE INDEX IF NOT EXISTS readings_by_tank_ts ON readings(tankId, ts);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  "#,
    )?;
    Ok(())
}

#[tauri::command]
fn sqlite_list_tanks(state: State<AppState>) -> Result<Vec<Tank>, String> {
    let conn = open_conn(&state.db_path).map_err(|e| e.to_string())?;
    let mut stmt = conn
    .prepare("SELECT id, name, createdAt, archivedAt, reminderCadence FROM tanks ORDER BY createdAt ASC")
    .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Tank {
                id: r.get(0)?,
                name: r.get(1)?,
                created_at: r.get(2)?,
                archived_at: r.get(3)?,
                reminder_cadence: r.get(4).ok(),
            })
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(Result::ok).collect())
}

#[tauri::command]
fn sqlite_create_tank(
    state: State<AppState>,
    name: String,
    reminder_cadence: Option<i64>,
) -> Result<Tank, String> {
    let conn = open_conn(&state.db_path).map_err(|e| e.to_string())?;
    let tank = Tank {
        id: Uuid::new_v4().to_string(),
        name,
        created_at: now_iso(),
        archived_at: None,
        reminder_cadence,
    };
    conn
    .execute(
      "INSERT INTO tanks (id, name, createdAt, archivedAt, reminderCadence) VALUES (?, ?, ?, ?, ?)",
      params![tank.id, tank.name, tank.created_at, tank.archived_at, tank.reminder_cadence],
    )
    .map_err(|e| e.to_string())?;
    Ok(tank)
}

#[tauri::command]
fn sqlite_rename_tank(state: State<AppState>, id: String, name: String) -> Result<(), String> {
    let conn = open_conn(&state.db_path).map_err(|e| e.to_string())?;
    conn.execute("UPDATE tanks SET name = ? WHERE id = ?", params![name, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn sqlite_archive_tank(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = open_conn(&state.db_path).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tanks SET archivedAt = ? WHERE id = ?",
        params![now_iso(), id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn sqlite_set_tank_reminder_cadence(
    state: State<AppState>,
    id: String,
    days: Option<i64>,
) -> Result<(), String> {
    let conn = open_conn(&state.db_path).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tanks SET reminderCadence = ? WHERE id = ?",
        params![days, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn sqlite_add_reading(state: State<AppState>, reading: Reading) -> Result<Reading, String> {
    let conn = open_conn(&state.db_path).map_err(|e| e.to_string())?;
    conn
    .execute(
      "INSERT INTO readings (id, tankId, ts, pH, ammonia, nitrite, nitrate, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      params![
        reading.id,
        reading.tank_id,
        reading.ts,
        reading.p_h,
        reading.ammonia,
        reading.nitrite,
        reading.nitrate,
        reading.note
      ],
    )
    .map_err(|e| e.to_string())?;
    Ok(reading)
}

#[tauri::command]
fn sqlite_update_reading(state: State<AppState>, reading: Reading) -> Result<(), String> {
    let conn = open_conn(&state.db_path).map_err(|e| e.to_string())?;
    conn
    .execute(
      "UPDATE readings SET tankId = ?, ts = ?, pH = ?, ammonia = ?, nitrite = ?, nitrate = ?, note = ? WHERE id = ?",
      params![
        reading.tank_id,
        reading.ts,
        reading.p_h,
        reading.ammonia,
        reading.nitrite,
        reading.nitrate,
        reading.note,
        reading.id
      ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn sqlite_delete_reading(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = open_conn(&state.db_path).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM readings WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn sqlite_list_readings_by_tank(
    state: State<AppState>,
    tank_id: String,
) -> Result<Vec<Reading>, String> {
    let conn = open_conn(&state.db_path).map_err(|e| e.to_string())?;
    let mut stmt = conn
    .prepare("SELECT id, tankId, ts, pH, ammonia, nitrite, nitrate, note FROM readings WHERE tankId = ? ORDER BY ts ASC")
    .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![tank_id], |r| {
            Ok(Reading {
                id: r.get(0)?,
                tank_id: r.get(1)?,
                ts: r.get(2)?,
                p_h: r.get(3)?,
                ammonia: r.get(4)?,
                nitrite: r.get(5)?,
                nitrate: r.get(6)?,
                note: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(Result::ok).collect())
}

#[tauri::command]
fn sqlite_list_readings_by_tank_in_range(
    state: State<AppState>,
    tank_id: String,
    from_iso: String,
    to_iso: String,
) -> Result<Vec<Reading>, String> {
    let conn = open_conn(&state.db_path).map_err(|e| e.to_string())?;
    let mut stmt = conn
    .prepare(
      "SELECT id, tankId, ts, pH, ammonia, nitrite, nitrate, note FROM readings WHERE tankId = ? AND ts BETWEEN ? AND ? ORDER BY ts ASC",
    )
    .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![tank_id, from_iso, to_iso], |r| {
            Ok(Reading {
                id: r.get(0)?,
                tank_id: r.get(1)?,
                ts: r.get(2)?,
                p_h: r.get(3)?,
                ammonia: r.get(4)?,
                nitrite: r.get(5)?,
                nitrate: r.get(6)?,
                note: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(Result::ok).collect())
}

#[tauri::command]
fn sqlite_get_settings(state: State<AppState>) -> Result<Option<Settings>, String> {
    let conn = open_conn(&state.db_path).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = 'global' LIMIT 1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    match rows.next() {
        Ok(Some(row)) => {
            let val: String = row.get(0).map_err(|e| e.to_string())?;
            let parsed: Settings = serde_json::from_str(&val).map_err(|e| e.to_string())?;
            Ok(Some(parsed))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn sqlite_set_settings(state: State<AppState>, value: Settings) -> Result<(), String> {
    let conn = open_conn(&state.db_path).map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&value).map_err(|e| e.to_string())?;
    conn
    .execute(
      "INSERT INTO settings(key, value) VALUES('global', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      params![json],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn sqlite_export_dump(state: State<AppState>) -> Result<Dump, String> {
    let conn = open_conn(&state.db_path).map_err(|e| e.to_string())?;
    // tanks
    let mut st = conn
        .prepare("SELECT id, name, createdAt, archivedAt, reminderCadence FROM tanks")
        .map_err(|e| e.to_string())?;
    let tanks: Vec<Tank> = st
        .query_map([], |r| {
            Ok(Tank {
                id: r.get(0)?,
                name: r.get(1)?,
                created_at: r.get(2)?,
                archived_at: r.get(3)?,
                reminder_cadence: r.get(4).ok(),
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    // readings
    let mut sr = conn
        .prepare("SELECT id, tankId, ts, pH, ammonia, nitrite, nitrate, note FROM readings")
        .map_err(|e| e.to_string())?;
    let readings: Vec<Reading> = sr
        .query_map([], |r| {
            Ok(Reading {
                id: r.get(0)?,
                tank_id: r.get(1)?,
                ts: r.get(2)?,
                p_h: r.get(3)?,
                ammonia: r.get(4)?,
                nitrite: r.get(5)?,
                nitrate: r.get(6)?,
                note: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    // settings
    let settings = sqlite_get_settings(state)?;
    Ok(Dump {
        tanks,
        readings,
        settings,
    })
}

#[tauri::command]
fn sqlite_import_dump(state: State<AppState>, dump: Dump) -> Result<(), String> {
    let mut conn = open_conn(&state.db_path).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for t in dump.tanks.iter() {
        tx.execute(
      "INSERT INTO tanks (id, name, createdAt, archivedAt, reminderCadence)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, createdAt=excluded.createdAt, archivedAt=excluded.archivedAt, reminderCadence=excluded.reminderCadence",
      params![t.id, t.name, t.created_at, t.archived_at, t.reminder_cadence],
    )
    .map_err(|e| e.to_string())?;
    }
    for r in dump.readings.iter() {
        tx.execute(
      "INSERT INTO readings (id, tankId, ts, pH, ammonia, nitrite, nitrate, note)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT(id) DO UPDATE SET tankId=excluded.tankId, ts=excluded.ts, pH=excluded.pH, ammonia=excluded.ammonia, nitrite=excluded.nitrite, nitrate=excluded.nitrate, note=excluded.note",
      params![r.id, r.tank_id, r.ts, r.p_h, r.ammonia, r.nitrite, r.nitrate, r.note],
    )
    .map_err(|e| e.to_string())?;
    }
    if let Some(s) = dump.settings {
        let json = serde_json::to_string(&s).map_err(|e| e.to_string())?;
        tx.execute(
      "INSERT INTO settings(key, value) VALUES('global', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      params![json],
    )
    .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    // Build a minimal native menu for navigation
    let nav_menu = Menu::new()
        .add_item(CustomMenuItem::new("nav_home", "Home").accelerator("CmdOrCtrl+1"))
        .add_item(CustomMenuItem::new("nav_charts", "Charts").accelerator("CmdOrCtrl+2"))
        .add_item(CustomMenuItem::new("nav_report", "Report").accelerator("CmdOrCtrl+3"))
        .add_item(CustomMenuItem::new("nav_settings", "Settings").accelerator("CmdOrCtrl+,"));
    let app_menu = Menu::new().add_submenu(Submenu::new("Navigate", nav_menu));

    tauri::Builder::default()
        .menu(app_menu)
        .on_menu_event(|event| {
            let target = match event.menu_item_id() {
                "nav_home" => Some("home"),
                "nav_charts" => Some("charts"),
                "nav_report" => Some("report"),
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
            let conn = open_conn(&db_path).map_err(|e| e.to_string())?;
            init_schema(&conn).map_err(|e| e.to_string())?;
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
            sqlite_add_reading,
            sqlite_update_reading,
            sqlite_delete_reading,
            sqlite_list_readings_by_tank,
            sqlite_list_readings_by_tank_in_range,
            sqlite_get_settings,
            sqlite_set_settings,
            sqlite_export_dump,
            sqlite_import_dump,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
