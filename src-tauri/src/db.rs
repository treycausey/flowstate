//! SQLite storage for the desktop app. Kept free of Tauri types so it can be unit tested
//! against an in-memory connection.

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

/// Schema version stored in `PRAGMA user_version`.
/// 0: original schema (metric columns NOT NULL; the version was never set).
/// 2: metric columns nullable, so a reading can leave metrics untested.
/// 3: `plants` and `plant_checks` tables. Only adds tables; existing rows are untouched.
/// 4: `stock` and `stock_events` tables and a nullable `tanks.volumeL` column. Only adds.
pub const SCHEMA_VERSION: i64 = 4;

/// Failure to open or migrate the database.
#[derive(Debug)]
pub enum DbError {
    Sqlite(rusqlite::Error),
    /// The file was written by a newer build than this one.
    NewerVersion {
        found: i64,
        supported: i64,
    },
}

impl std::fmt::Display for DbError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DbError::Sqlite(e) => e.fmt(f),
            DbError::NewerVersion { found, supported } => write!(
                f,
                "database was created by a newer Flowstate (schema version {found}, this build supports up to {supported})"
            ),
        }
    }
}

impl std::error::Error for DbError {}

impl From<rusqlite::Error> for DbError {
    fn from(e: rusqlite::Error) -> Self {
        DbError::Sqlite(e)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Tank {
    pub id: String,
    pub name: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "archivedAt")]
    pub archived_at: Option<String>,
    #[serde(rename = "reminderCadence")]
    pub reminder_cadence: Option<i64>,
    /// Water volume in litres.
    #[serde(default, rename = "volumeL")]
    pub volume_l: Option<f64>,
}

/// A metric is `None` when that test was not run for the reading.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Reading {
    pub id: String,
    #[serde(rename = "tankId")]
    pub tank_id: String,
    pub ts: String,
    #[serde(rename = "pH")]
    pub p_h: Option<f64>,
    pub ammonia: Option<f64>,
    pub nitrite: Option<f64>,
    pub nitrate: Option<f64>,
    pub note: Option<String>,
}

/// A plant in a tank. `species_id` is None for a custom plant.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Plant {
    pub id: String,
    #[serde(rename = "tankId")]
    pub tank_id: String,
    #[serde(rename = "speciesId")]
    pub species_id: Option<String>,
    pub name: String,
    pub placement: String,
    #[serde(rename = "plantedAt")]
    pub planted_at: String,
    #[serde(rename = "removedAt")]
    pub removed_at: Option<String>,
    pub note: Option<String>,
}

/// One health check of one plant. `symptoms` is stored as a JSON array in a TEXT column.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct PlantCheck {
    pub id: String,
    #[serde(rename = "plantId")]
    pub plant_id: String,
    #[serde(rename = "tankId")]
    pub tank_id: String,
    pub ts: String,
    pub health: String,
    #[serde(default)]
    pub symptoms: Vec<String>,
    pub action: Option<String>,
    pub note: Option<String>,
}

/// A group of one species in a tank. `species_id` is None for a custom species.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct StockGroup {
    pub id: String,
    #[serde(rename = "tankId")]
    pub tank_id: String,
    #[serde(rename = "speciesId")]
    pub species_id: Option<String>,
    pub name: String,
    pub count: i64,
    #[serde(rename = "addedAt")]
    pub added_at: String,
    #[serde(default, rename = "removedAt")]
    pub removed_at: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
}

/// Something that happened to a group (`stock_id` set) or to the whole tank (None).
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct StockEvent {
    pub id: String,
    #[serde(rename = "tankId")]
    pub tank_id: String,
    #[serde(rename = "stockId")]
    pub stock_id: Option<String>,
    pub ts: String,
    pub kind: String,
    #[serde(default, rename = "countDelta")]
    pub count_delta: Option<i64>,
    #[serde(default)]
    pub health: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Settings {
    pub units: Option<String>,
    pub theme: Option<String>,
    #[serde(rename = "chartOptions")]
    pub chart_options: Option<serde_json::Value>,
    /// Every other settings key (`livingTank`, `hemisphere`, `shimmerSeen`, future keys)
    /// passes through untouched, so the desktop app never drops settings it does not know.
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Dump {
    pub tanks: Vec<Tank>,
    pub readings: Vec<Reading>,
    /// Absent in backups made before plants existed.
    #[serde(default)]
    pub plants: Vec<Plant>,
    #[serde(default, rename = "plantChecks")]
    pub plant_checks: Vec<PlantCheck>,
    /// Absent in backups made before stock existed.
    #[serde(default)]
    pub stock: Vec<StockGroup>,
    #[serde(default, rename = "stockEvents")]
    pub stock_events: Vec<StockEvent>,
    pub settings: Option<Settings>,
}

pub fn now_iso() -> String {
    let now: DateTime<Utc> = Utc::now();
    now.to_rfc3339()
}

const CREATE_READINGS: &str = r#"
    CREATE TABLE readings (
      id TEXT PRIMARY KEY,
      tankId TEXT NOT NULL,
      ts TEXT NOT NULL,
      pH REAL,
      ammonia REAL,
      nitrite REAL,
      nitrate REAL,
      note TEXT,
      FOREIGN KEY(tankId) REFERENCES tanks(id)
    )"#;

const CREATE_PLANTS: &str = r#"
    CREATE TABLE IF NOT EXISTS plants (
      id TEXT PRIMARY KEY,
      tankId TEXT NOT NULL,
      speciesId TEXT,
      name TEXT NOT NULL,
      placement TEXT NOT NULL,
      plantedAt TEXT NOT NULL,
      removedAt TEXT,
      note TEXT,
      FOREIGN KEY(tankId) REFERENCES tanks(id)
    );
    CREATE TABLE IF NOT EXISTS plant_checks (
      id TEXT PRIMARY KEY,
      plantId TEXT NOT NULL,
      tankId TEXT NOT NULL,
      ts TEXT NOT NULL,
      health TEXT NOT NULL,
      symptoms TEXT NOT NULL DEFAULT '[]',
      action TEXT,
      note TEXT,
      FOREIGN KEY(plantId) REFERENCES plants(id) ON DELETE CASCADE,
      FOREIGN KEY(tankId) REFERENCES tanks(id)
    );
    CREATE INDEX IF NOT EXISTS plants_by_tank ON plants(tankId);
    CREATE INDEX IF NOT EXISTS plant_checks_by_plant ON plant_checks(plantId);
    CREATE INDEX IF NOT EXISTS plant_checks_by_tank_ts ON plant_checks(tankId, ts);
"#;

const CREATE_STOCK: &str = r#"
    CREATE TABLE IF NOT EXISTS stock (
      id TEXT PRIMARY KEY,
      tankId TEXT NOT NULL,
      speciesId TEXT,
      name TEXT NOT NULL,
      count INTEGER NOT NULL,
      addedAt TEXT NOT NULL,
      removedAt TEXT,
      note TEXT,
      FOREIGN KEY(tankId) REFERENCES tanks(id)
    );
    CREATE TABLE IF NOT EXISTS stock_events (
      id TEXT PRIMARY KEY,
      tankId TEXT NOT NULL,
      stockId TEXT,
      ts TEXT NOT NULL,
      kind TEXT NOT NULL,
      countDelta INTEGER,
      health TEXT,
      note TEXT,
      FOREIGN KEY(tankId) REFERENCES tanks(id)
    );
    CREATE INDEX IF NOT EXISTS stock_by_tank ON stock(tankId);
    CREATE INDEX IF NOT EXISTS stock_events_by_stock ON stock_events(stockId);
    CREATE INDEX IF NOT EXISTS stock_events_by_tank_ts ON stock_events(tankId, ts);
"#;

const CREATE_INDEXES: &str = r#"
    CREATE INDEX IF NOT EXISTS readings_by_tank ON readings(tankId);
    CREATE INDEX IF NOT EXISTS readings_by_tank_ts ON readings(tankId, ts);
"#;

fn user_version(conn: &Connection) -> rusqlite::Result<i64> {
    conn.query_row("PRAGMA user_version", [], |r| r.get(0))
}

fn readings_table_exists(conn: &Connection) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'readings'",
        [],
        |r| r.get::<_, i64>(0),
    )
    .map(|n| n > 0)
}

/// Create the schema on a fresh database, or migrate an older one. Idempotent.
/// All changes run in one transaction, so a failure leaves the database untouched.
pub fn init_schema(conn: &mut Connection) -> Result<(), DbError> {
    let version = user_version(conn)?;
    if version > SCHEMA_VERSION {
        return Err(DbError::NewerVersion {
            found: version,
            supported: SCHEMA_VERSION,
        });
    }
    if version == SCHEMA_VERSION {
        return Ok(());
    }
    let tx = conn.transaction()?;
    tx.execute_batch(
        r#"
    CREATE TABLE IF NOT EXISTS tanks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      archivedAt TEXT,
      reminderCadence INTEGER
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  "#,
    )?;
    if !readings_table_exists(&tx)? {
        tx.execute_batch(&format!("{};", CREATE_READINGS))?;
    } else if version < 2 {
        // Old schema: rebuild without NOT NULL on the metric columns, keeping every row as is.
        tx.execute_batch(&format!(
            "{};",
            CREATE_READINGS.replace("readings", "readings_new")
        ))?;
        tx.execute_batch(
            "INSERT INTO readings_new (id, tankId, ts, pH, ammonia, nitrite, nitrate, note)
             SELECT id, tankId, ts, pH, ammonia, nitrite, nitrate, note FROM readings;
             DROP TABLE readings;
             ALTER TABLE readings_new RENAME TO readings;",
        )?;
    }
    tx.execute_batch(CREATE_INDEXES)?;
    tx.execute_batch(CREATE_PLANTS)?;
    tx.execute_batch(CREATE_STOCK)?;
    let has_volume: i64 = tx.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('tanks') WHERE name = 'volumeL'",
        [],
        |r| r.get(0),
    )?;
    if has_volume == 0 {
        tx.execute_batch("ALTER TABLE tanks ADD COLUMN volumeL REAL;")?;
    }
    tx.execute_batch(&format!("PRAGMA user_version = {};", SCHEMA_VERSION))?;
    tx.commit()?;
    Ok(())
}

fn tank_from_row(r: &rusqlite::Row) -> rusqlite::Result<Tank> {
    Ok(Tank {
        id: r.get(0)?,
        name: r.get(1)?,
        created_at: r.get(2)?,
        archived_at: r.get(3)?,
        reminder_cadence: r.get(4)?,
        volume_l: r.get(5)?,
    })
}

const TANK_COLS: &str = "id, name, createdAt, archivedAt, reminderCadence, volumeL";

fn reading_from_row(r: &rusqlite::Row) -> rusqlite::Result<Reading> {
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
}

const READING_COLS: &str = "id, tankId, ts, pH, ammonia, nitrite, nitrate, note";

pub fn list_tanks(conn: &Connection) -> rusqlite::Result<Vec<Tank>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {TANK_COLS} FROM tanks ORDER BY createdAt ASC"
    ))?;
    let rows = stmt.query_map([], tank_from_row)?;
    rows.collect()
}

pub fn create_tank(
    conn: &Connection,
    name: String,
    reminder_cadence: Option<i64>,
    id: String,
) -> rusqlite::Result<Tank> {
    let tank = Tank {
        id,
        name,
        created_at: now_iso(),
        archived_at: None,
        reminder_cadence,
        volume_l: None,
    };
    conn.execute(
        "INSERT INTO tanks (id, name, createdAt, archivedAt, reminderCadence) VALUES (?, ?, ?, ?, ?)",
        params![tank.id, tank.name, tank.created_at, tank.archived_at, tank.reminder_cadence],
    )?;
    Ok(tank)
}

pub fn rename_tank(conn: &Connection, id: &str, name: &str) -> rusqlite::Result<()> {
    conn.execute("UPDATE tanks SET name = ? WHERE id = ?", params![name, id])?;
    Ok(())
}

pub fn archive_tank(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE tanks SET archivedAt = ? WHERE id = ?",
        params![now_iso(), id],
    )?;
    Ok(())
}

pub fn set_tank_reminder_cadence(
    conn: &Connection,
    id: &str,
    days: Option<i64>,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE tanks SET reminderCadence = ? WHERE id = ?",
        params![days, id],
    )?;
    Ok(())
}

pub fn set_tank_volume(conn: &Connection, id: &str, volume_l: Option<f64>) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE tanks SET volumeL = ? WHERE id = ?",
        params![volume_l, id],
    )?;
    Ok(())
}

pub fn add_reading(conn: &Connection, reading: &Reading) -> rusqlite::Result<()> {
    conn.execute(
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
    )?;
    Ok(())
}

pub fn update_reading(conn: &Connection, reading: &Reading) -> rusqlite::Result<()> {
    conn.execute(
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
    )?;
    Ok(())
}

pub fn delete_reading(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM readings WHERE id = ?", params![id])?;
    Ok(())
}

pub fn list_readings_by_tank(conn: &Connection, tank_id: &str) -> rusqlite::Result<Vec<Reading>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {READING_COLS} FROM readings WHERE tankId = ? ORDER BY ts ASC"
    ))?;
    let rows = stmt.query_map(params![tank_id], reading_from_row)?;
    rows.collect()
}

pub fn list_readings_by_tank_in_range(
    conn: &Connection,
    tank_id: &str,
    from_iso: &str,
    to_iso: &str,
) -> rusqlite::Result<Vec<Reading>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {READING_COLS} FROM readings WHERE tankId = ? AND ts BETWEEN ? AND ? ORDER BY ts ASC"
    ))?;
    let rows = stmt.query_map(params![tank_id, from_iso, to_iso], reading_from_row)?;
    rows.collect()
}

fn plant_from_row(r: &rusqlite::Row) -> rusqlite::Result<Plant> {
    Ok(Plant {
        id: r.get(0)?,
        tank_id: r.get(1)?,
        species_id: r.get(2)?,
        name: r.get(3)?,
        placement: r.get(4)?,
        planted_at: r.get(5)?,
        removed_at: r.get(6)?,
        note: r.get(7)?,
    })
}

const PLANT_COLS: &str = "id, tankId, speciesId, name, placement, plantedAt, removedAt, note";

pub fn add_plant(conn: &Connection, plant: &Plant) -> rusqlite::Result<()> {
    conn.execute(
        &format!("INSERT INTO plants ({PLANT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
        params![
            plant.id,
            plant.tank_id,
            plant.species_id,
            plant.name,
            plant.placement,
            plant.planted_at,
            plant.removed_at,
            plant.note
        ],
    )?;
    Ok(())
}

pub fn update_plant(conn: &Connection, plant: &Plant) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE plants SET tankId = ?, speciesId = ?, name = ?, placement = ?, plantedAt = ?, removedAt = ?, note = ? WHERE id = ?",
        params![
            plant.tank_id,
            plant.species_id,
            plant.name,
            plant.placement,
            plant.planted_at,
            plant.removed_at,
            plant.note,
            plant.id
        ],
    )?;
    Ok(())
}

/// Deletes the plant and its checks in one transaction. Does not rely on foreign keys being on.
pub fn delete_plant(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM plant_checks WHERE plantId = ?", params![id])?;
    tx.execute("DELETE FROM plants WHERE id = ?", params![id])?;
    tx.commit()
}

/// Every plant of a tank, removed ones included, oldest planted first.
pub fn list_plants_by_tank(conn: &Connection, tank_id: &str) -> rusqlite::Result<Vec<Plant>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {PLANT_COLS} FROM plants WHERE tankId = ? ORDER BY plantedAt ASC"
    ))?;
    let rows = stmt.query_map(params![tank_id], plant_from_row)?;
    rows.collect()
}

fn plant_check_from_row(r: &rusqlite::Row) -> rusqlite::Result<PlantCheck> {
    let symptoms: String = r.get(5)?;
    let symptoms: Vec<String> = serde_json::from_str(&symptoms).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(5, rusqlite::types::Type::Text, Box::new(e))
    })?;
    Ok(PlantCheck {
        id: r.get(0)?,
        plant_id: r.get(1)?,
        tank_id: r.get(2)?,
        ts: r.get(3)?,
        health: r.get(4)?,
        symptoms,
        action: r.get(6)?,
        note: r.get(7)?,
    })
}

const CHECK_COLS: &str = "id, plantId, tankId, ts, health, symptoms, action, note";

pub fn add_plant_check(conn: &Connection, check: &PlantCheck) -> rusqlite::Result<()> {
    let symptoms = serde_json::to_string(&check.symptoms)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        &format!("INSERT INTO plant_checks ({CHECK_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
        params![
            check.id,
            check.plant_id,
            check.tank_id,
            check.ts,
            check.health,
            symptoms,
            check.action,
            check.note
        ],
    )?;
    Ok(())
}

/// All plant checks of a tank, oldest first.
pub fn list_plant_checks_by_tank(
    conn: &Connection,
    tank_id: &str,
) -> rusqlite::Result<Vec<PlantCheck>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {CHECK_COLS} FROM plant_checks WHERE tankId = ? ORDER BY ts ASC"
    ))?;
    let rows = stmt.query_map(params![tank_id], plant_check_from_row)?;
    rows.collect()
}

fn stock_from_row(r: &rusqlite::Row) -> rusqlite::Result<StockGroup> {
    Ok(StockGroup {
        id: r.get(0)?,
        tank_id: r.get(1)?,
        species_id: r.get(2)?,
        name: r.get(3)?,
        count: r.get(4)?,
        added_at: r.get(5)?,
        removed_at: r.get(6)?,
        note: r.get(7)?,
    })
}

const STOCK_COLS: &str = "id, tankId, speciesId, name, count, addedAt, removedAt, note";

pub fn add_stock(conn: &Connection, group: &StockGroup) -> rusqlite::Result<()> {
    conn.execute(
        &format!("INSERT INTO stock ({STOCK_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
        params![
            group.id,
            group.tank_id,
            group.species_id,
            group.name,
            group.count,
            group.added_at,
            group.removed_at,
            group.note
        ],
    )?;
    Ok(())
}

pub fn update_stock(conn: &Connection, group: &StockGroup) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE stock SET tankId = ?, speciesId = ?, name = ?, count = ?, addedAt = ?, removedAt = ?, note = ? WHERE id = ?",
        params![
            group.tank_id,
            group.species_id,
            group.name,
            group.count,
            group.added_at,
            group.removed_at,
            group.note,
            group.id
        ],
    )?;
    Ok(())
}

/// Deletes the group and its events in one transaction. Does not rely on foreign keys being on.
pub fn delete_stock(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM stock_events WHERE stockId = ?", params![id])?;
    tx.execute("DELETE FROM stock WHERE id = ?", params![id])?;
    tx.commit()
}

/// Every group of a tank, removed ones included, oldest added first.
pub fn list_stock_by_tank(conn: &Connection, tank_id: &str) -> rusqlite::Result<Vec<StockGroup>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {STOCK_COLS} FROM stock WHERE tankId = ? ORDER BY addedAt ASC"
    ))?;
    let rows = stmt.query_map(params![tank_id], stock_from_row)?;
    rows.collect()
}

fn stock_event_from_row(r: &rusqlite::Row) -> rusqlite::Result<StockEvent> {
    Ok(StockEvent {
        id: r.get(0)?,
        tank_id: r.get(1)?,
        stock_id: r.get(2)?,
        ts: r.get(3)?,
        kind: r.get(4)?,
        count_delta: r.get(5)?,
        health: r.get(6)?,
        note: r.get(7)?,
    })
}

const EVENT_COLS: &str = "id, tankId, stockId, ts, kind, countDelta, health, note";

/// Adds the event. For lost, rehomed and added it also changes the group's count in the same
/// transaction (never below 0; a group at 0 gets `removedAt`, and adding to one brings it back).
/// The stored `countDelta` is the signed change that was really applied. Returns the stored event.
pub fn add_stock_event(conn: &Connection, event: &StockEvent) -> Result<StockEvent, String> {
    let mut saved = event.clone();
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    if let Some(stock_id) = &event.stock_id {
        let (count, removed_at): (i64, Option<String>) = tx
            .query_row(
                "SELECT count, removedAt FROM stock WHERE id = ?",
                params![stock_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .map_err(|_| "That group no longer exists.".to_string())?;
        if matches!(event.kind.as_str(), "lost" | "rehomed" | "added") {
            let raw = event.count_delta.unwrap_or(0);
            if raw == 0 {
                return Err("Enter how many animals.".to_string());
            }
            let signed = if event.kind == "added" {
                raw.abs()
            } else {
                -raw.abs()
            };
            let next = (count + signed).max(0);
            let removed = if next == 0 {
                Some(event.ts.clone())
            } else if count == 0 {
                None
            } else {
                removed_at
            };
            tx.execute(
                "UPDATE stock SET count = ?, removedAt = ? WHERE id = ?",
                params![next, removed, stock_id],
            )
            .map_err(|e| e.to_string())?;
            saved.count_delta = Some(next - count);
        }
    }
    tx.execute(
        &format!("INSERT INTO stock_events ({EVENT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
        params![
            saved.id,
            saved.tank_id,
            saved.stock_id,
            saved.ts,
            saved.kind,
            saved.count_delta,
            saved.health,
            saved.note
        ],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(saved)
}

/// All stock events of a tank, oldest first.
pub fn list_stock_events_by_tank(
    conn: &Connection,
    tank_id: &str,
) -> rusqlite::Result<Vec<StockEvent>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {EVENT_COLS} FROM stock_events WHERE tankId = ? ORDER BY ts ASC"
    ))?;
    let rows = stmt.query_map(params![tank_id], stock_event_from_row)?;
    rows.collect()
}

pub fn get_settings(conn: &Connection) -> Result<Option<Settings>, String> {
    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = 'global' LIMIT 1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    match rows.next().map_err(|e| e.to_string())? {
        Some(row) => {
            let val: String = row.get(0).map_err(|e| e.to_string())?;
            let parsed: Settings = serde_json::from_str(&val).map_err(|e| e.to_string())?;
            Ok(Some(parsed))
        }
        None => Ok(None),
    }
}

pub fn set_settings(conn: &Connection, value: &Settings) -> Result<(), String> {
    let json = serde_json::to_string(value).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings(key, value) VALUES('global', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![json],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn export_dump(conn: &Connection) -> Result<Dump, String> {
    let mut st = conn
        .prepare(&format!("SELECT {TANK_COLS} FROM tanks"))
        .map_err(|e| e.to_string())?;
    let tanks = st
        .query_map([], tank_from_row)
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    let mut sr = conn
        .prepare(&format!("SELECT {READING_COLS} FROM readings"))
        .map_err(|e| e.to_string())?;
    let readings = sr
        .query_map([], reading_from_row)
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    let mut sp = conn
        .prepare(&format!("SELECT {PLANT_COLS} FROM plants"))
        .map_err(|e| e.to_string())?;
    let plants = sp
        .query_map([], plant_from_row)
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    let mut sc = conn
        .prepare(&format!("SELECT {CHECK_COLS} FROM plant_checks"))
        .map_err(|e| e.to_string())?;
    let plant_checks = sc
        .query_map([], plant_check_from_row)
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    let mut sg = conn
        .prepare(&format!("SELECT {STOCK_COLS} FROM stock"))
        .map_err(|e| e.to_string())?;
    let stock = sg
        .query_map([], stock_from_row)
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    let mut se = conn
        .prepare(&format!("SELECT {EVENT_COLS} FROM stock_events"))
        .map_err(|e| e.to_string())?;
    let stock_events = se
        .query_map([], stock_event_from_row)
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    let settings = get_settings(conn)?;
    Ok(Dump {
        tanks,
        readings,
        plants,
        plant_checks,
        stock,
        stock_events,
        settings,
    })
}

pub fn import_dump(conn: &mut Connection, dump: &Dump) -> Result<(), String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for t in dump.tanks.iter() {
        tx.execute(
            "INSERT INTO tanks (id, name, createdAt, archivedAt, reminderCadence, volumeL)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, createdAt=excluded.createdAt, archivedAt=excluded.archivedAt, reminderCadence=excluded.reminderCadence, volumeL=excluded.volumeL",
            params![t.id, t.name, t.created_at, t.archived_at, t.reminder_cadence, t.volume_l],
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
    for p in dump.plants.iter() {
        tx.execute(
            "INSERT INTO plants (id, tankId, speciesId, name, placement, plantedAt, removedAt, note)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT(id) DO UPDATE SET tankId=excluded.tankId, speciesId=excluded.speciesId, name=excluded.name, placement=excluded.placement, plantedAt=excluded.plantedAt, removedAt=excluded.removedAt, note=excluded.note",
            params![
                p.id,
                p.tank_id,
                p.species_id,
                p.name,
                p.placement,
                p.planted_at,
                p.removed_at,
                p.note
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    for c in dump.plant_checks.iter() {
        let symptoms = serde_json::to_string(&c.symptoms).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO plant_checks (id, plantId, tankId, ts, health, symptoms, action, note)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT(id) DO UPDATE SET plantId=excluded.plantId, tankId=excluded.tankId, ts=excluded.ts, health=excluded.health, symptoms=excluded.symptoms, action=excluded.action, note=excluded.note",
            params![c.id, c.plant_id, c.tank_id, c.ts, c.health, symptoms, c.action, c.note],
        )
        .map_err(|e| e.to_string())?;
    }
    for g in dump.stock.iter() {
        tx.execute(
            "INSERT INTO stock (id, tankId, speciesId, name, count, addedAt, removedAt, note)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT(id) DO UPDATE SET tankId=excluded.tankId, speciesId=excluded.speciesId, name=excluded.name, count=excluded.count, addedAt=excluded.addedAt, removedAt=excluded.removedAt, note=excluded.note",
            params![
                g.id,
                g.tank_id,
                g.species_id,
                g.name,
                g.count,
                g.added_at,
                g.removed_at,
                g.note
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    for e in dump.stock_events.iter() {
        tx.execute(
            "INSERT INTO stock_events (id, tankId, stockId, ts, kind, countDelta, health, note)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT(id) DO UPDATE SET tankId=excluded.tankId, stockId=excluded.stockId, ts=excluded.ts, kind=excluded.kind, countDelta=excluded.countDelta, health=excluded.health, note=excluded.note",
            params![
                e.id,
                e.tank_id,
                e.stock_id,
                e.ts,
                e.kind,
                e.count_delta,
                e.health,
                e.note
            ],
        )
        .map_err(|err| err.to_string())?;
    }
    if let Some(s) = &dump.settings {
        let json = serde_json::to_string(s).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO settings(key, value) VALUES('global', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![json],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const OLD_SCHEMA: &str = r#"
    CREATE TABLE tanks (id TEXT PRIMARY KEY, name TEXT NOT NULL, createdAt TEXT NOT NULL, archivedAt TEXT, reminderCadence INTEGER);
    CREATE TABLE readings (
      id TEXT PRIMARY KEY, tankId TEXT NOT NULL, ts TEXT NOT NULL,
      pH REAL NOT NULL, ammonia REAL NOT NULL, nitrite REAL NOT NULL, nitrate REAL NOT NULL,
      note TEXT, FOREIGN KEY(tankId) REFERENCES tanks(id));
    CREATE INDEX readings_by_tank ON readings(tankId);
    CREATE INDEX readings_by_tank_ts ON readings(tankId, ts);
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    "#;

    fn reading(id: &str, ts: &str, p_h: Option<f64>, ammonia: Option<f64>) -> Reading {
        Reading {
            id: id.into(),
            tank_id: "t1".into(),
            ts: ts.into(),
            p_h,
            ammonia,
            nitrite: None,
            nitrate: None,
            note: None,
        }
    }

    fn index_names(conn: &Connection) -> Vec<String> {
        let mut st = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'readings_by%' ORDER BY name")
            .unwrap();
        st.query_map([], |r| r.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap()
    }

    #[test]
    fn fresh_db_gets_new_schema() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&mut conn).unwrap();
        assert_eq!(user_version(&conn).unwrap(), SCHEMA_VERSION);
        create_tank(&conn, "T".into(), None, "t1".into()).unwrap();
        // A reading with every metric NULL is accepted by the schema itself.
        add_reading(&conn, &reading("r1", "2026-01-01T00:00:00Z", None, None)).unwrap();
        assert_eq!(
            index_names(&conn),
            vec!["readings_by_tank", "readings_by_tank_ts"]
        );
    }

    #[test]
    fn migrates_old_schema_preserving_rows() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(OLD_SCHEMA).unwrap();
        conn.execute_batch(
            "INSERT INTO tanks VALUES ('t1','Main','2026-01-01T00:00:00Z',NULL,3);
             INSERT INTO readings VALUES ('r1','t1','2026-01-02T10:00:00Z',7.2,0.25,0,12.5,'first');
             INSERT INTO readings VALUES ('r2','t1','2026-01-03T10:00:00Z',6.8,0,0.1,0,NULL);
             INSERT INTO settings VALUES ('global','{\"theme\":\"dark\"}');",
        )
        .unwrap();
        let before = list_readings_by_tank(&conn, "t1").unwrap();
        assert_eq!(before.len(), 2);

        init_schema(&mut conn).unwrap();

        assert_eq!(user_version(&conn).unwrap(), SCHEMA_VERSION);
        let after = export_dump(&conn).unwrap();
        assert_eq!(after.readings, before);
        assert_eq!(after.readings[0].note.as_deref(), Some("first"));
        assert_eq!(after.readings[1].nitrite, Some(0.1));
        assert_eq!(after.tanks.len(), 1);
        assert_eq!(after.tanks[0].reminder_cadence, Some(3));
        assert_eq!(after.settings.unwrap().theme.as_deref(), Some("dark"));
        assert_eq!(
            index_names(&conn),
            vec!["readings_by_tank", "readings_by_tank_ts"]
        );
        // The rebuilt table now accepts NULL metrics.
        add_reading(
            &conn,
            &reading("r3", "2026-01-04T00:00:00Z", None, Some(0.5)),
        )
        .unwrap();
    }

    #[test]
    fn migration_twice_is_a_no_op() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(OLD_SCHEMA).unwrap();
        conn.execute_batch(
            "INSERT INTO tanks VALUES ('t1','Main','2026-01-01T00:00:00Z',NULL,NULL);
             INSERT INTO readings VALUES ('r1','t1','2026-01-02T10:00:00Z',7.2,0.25,0,12.5,NULL);",
        )
        .unwrap();
        init_schema(&mut conn).unwrap();
        let once = export_dump(&conn).unwrap().readings;
        init_schema(&mut conn).unwrap();
        init_schema(&mut conn).unwrap();
        assert_eq!(export_dump(&conn).unwrap().readings, once);
        assert_eq!(user_version(&conn).unwrap(), SCHEMA_VERSION);
    }

    #[test]
    fn rejects_a_database_from_a_newer_version() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(&format!("PRAGMA user_version = {};", SCHEMA_VERSION + 1))
            .unwrap();
        let err = init_schema(&mut conn).unwrap_err().to_string();
        assert!(err.contains("newer Flowstate"), "unexpected error: {err}");
        // Nothing was created or changed.
        assert!(!readings_table_exists(&conn).unwrap());
        assert_eq!(user_version(&conn).unwrap(), SCHEMA_VERSION + 1);
    }

    #[test]
    fn null_metrics_round_trip() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&mut conn).unwrap();
        create_tank(&conn, "T".into(), None, "t1".into()).unwrap();
        let partial = Reading {
            nitrite: Some(0.25),
            ..reading("r1", "2026-01-01T00:00:00Z", None, Some(0.5))
        };
        add_reading(&conn, &partial).unwrap();
        assert_eq!(
            list_readings_by_tank(&conn, "t1").unwrap(),
            vec![partial.clone()]
        );

        // Clearing a metric on update stores NULL.
        let cleared = Reading {
            ammonia: None,
            ..partial
        };
        update_reading(&conn, &cleared).unwrap();
        let got = list_readings_by_tank_in_range(
            &conn,
            "t1",
            "2026-01-01T00:00:00Z",
            "2026-01-02T00:00:00Z",
        )
        .unwrap();
        assert_eq!(got, vec![cleared.clone()]);

        // JSON null and missing keys both deserialize to None; None serializes to null.
        let json = serde_json::to_value(&cleared).unwrap();
        assert!(json["pH"].is_null() && json["ammonia"].is_null());
        let back: Reading = serde_json::from_value(json).unwrap();
        assert_eq!(back, cleared);
    }

    #[test]
    fn unknown_settings_keys_round_trip() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&mut conn).unwrap();
        let incoming: Settings = serde_json::from_str(
            r#"{"theme":"dark","livingTank":false,"hemisphere":"south","shimmerSeen":["t1"],"futureKey":{"a":1}}"#,
        )
        .unwrap();
        set_settings(&conn, &incoming).unwrap();
        let stored = get_settings(&conn).unwrap().unwrap();
        let out = serde_json::to_value(&stored).unwrap();
        assert_eq!(out["livingTank"], serde_json::json!(false));
        assert_eq!(out["hemisphere"], serde_json::json!("south"));
        assert_eq!(out["shimmerSeen"], serde_json::json!(["t1"]));
        assert_eq!(out["futureKey"], serde_json::json!({"a": 1}));
        assert_eq!(stored.theme.as_deref(), Some("dark"));
        // export_dump and import_dump keep them too.
        let dump = export_dump(&conn).unwrap();
        let mut other = Connection::open_in_memory().unwrap();
        init_schema(&mut other).unwrap();
        import_dump(&mut other, &dump).unwrap();
        let again = serde_json::to_value(get_settings(&other).unwrap().unwrap()).unwrap();
        assert_eq!(again["shimmerSeen"], serde_json::json!(["t1"]));
        assert_eq!(again["futureKey"], serde_json::json!({"a": 1}));
    }

    #[test]
    fn older_stored_settings_still_load() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&mut conn).unwrap();
        conn.execute_batch(
            "INSERT INTO settings VALUES ('global','{\"units\":\"metric\",\"theme\":\"light\",\"chartOptions\":{\"rollingAverageDays\":7}}');",
        )
        .unwrap();
        let s = get_settings(&conn).unwrap().unwrap();
        assert_eq!(s.units.as_deref(), Some("metric"));
        assert_eq!(s.theme.as_deref(), Some("light"));
        assert!(s.chart_options.is_some());
        assert!(s.extra.is_empty());
    }

    // ---- Plants (schema version 3) ---------------------------------------------------------

    /// A database as written by the build before plants: version 2, with data.
    const V2_SCHEMA: &str = r#"
    CREATE TABLE tanks (id TEXT PRIMARY KEY, name TEXT NOT NULL, createdAt TEXT NOT NULL, archivedAt TEXT, reminderCadence INTEGER);
    CREATE TABLE readings (
      id TEXT PRIMARY KEY, tankId TEXT NOT NULL, ts TEXT NOT NULL,
      pH REAL, ammonia REAL, nitrite REAL, nitrate REAL,
      note TEXT, FOREIGN KEY(tankId) REFERENCES tanks(id));
    CREATE INDEX readings_by_tank ON readings(tankId);
    CREATE INDEX readings_by_tank_ts ON readings(tankId, ts);
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    PRAGMA user_version = 2;
    "#;

    fn plant(id: &str, planted_at: &str) -> Plant {
        Plant {
            id: id.into(),
            tank_id: "t1".into(),
            species_id: Some("anubias-nana".into()),
            name: "Anubias nana".into(),
            placement: "epiphyte".into(),
            planted_at: planted_at.into(),
            removed_at: None,
            note: None,
        }
    }

    fn check(id: &str, plant_id: &str, ts: &str, health: &str) -> PlantCheck {
        PlantCheck {
            id: id.into(),
            plant_id: plant_id.into(),
            tank_id: "t1".into(),
            ts: ts.into(),
            health: health.into(),
            symptoms: vec!["pinholes".into(), "brown-edges".into()],
            action: Some("trimmed".into()),
            note: Some("edges".into()),
        }
    }

    fn table_exists(conn: &Connection, name: &str) -> bool {
        conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
            params![name],
            |r| r.get::<_, i64>(0),
        )
        .unwrap()
            > 0
    }

    #[test]
    fn fresh_db_has_plant_tables() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&mut conn).unwrap();
        assert_eq!(SCHEMA_VERSION, 4);
        assert_eq!(user_version(&conn).unwrap(), 4);
        assert!(table_exists(&conn, "plants"));
        assert!(table_exists(&conn, "plant_checks"));
    }

    #[test]
    fn migrates_v2_database_keeping_readings_and_settings() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(V2_SCHEMA).unwrap();
        conn.execute_batch(
            "INSERT INTO tanks VALUES ('t1','Main','2026-01-01T00:00:00Z',NULL,3);
             INSERT INTO readings VALUES ('r1','t1','2026-01-02T10:00:00Z',7.2,NULL,0,12.5,'first');
             INSERT INTO settings VALUES ('global','{\"theme\":\"dark\"}');",
        )
        .unwrap();
        assert!(!table_exists(&conn, "plants"));
        let before = list_readings_by_tank(&conn, "t1").unwrap();

        init_schema(&mut conn).unwrap();

        assert_eq!(user_version(&conn).unwrap(), 4);
        assert!(table_exists(&conn, "plants"));
        let after = export_dump(&conn).unwrap();
        assert_eq!(after.readings, before);
        assert_eq!(after.readings[0].ammonia, None);
        assert_eq!(after.tanks[0].reminder_cadence, Some(3));
        assert_eq!(after.settings.unwrap().theme.as_deref(), Some("dark"));
        assert!(after.plants.is_empty() && after.plant_checks.is_empty());

        // The migrated database takes plants, and a second run changes nothing.
        add_plant(&conn, &plant("p1", "2026-02-01T00:00:00Z")).unwrap();
        init_schema(&mut conn).unwrap();
        assert_eq!(list_plants_by_tank(&conn, "t1").unwrap().len(), 1);
    }

    #[test]
    fn migrates_v0_database_through_to_plants() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(OLD_SCHEMA).unwrap();
        conn.execute_batch(
            "INSERT INTO tanks VALUES ('t1','Main','2026-01-01T00:00:00Z',NULL,NULL);
             INSERT INTO readings VALUES ('r1','t1','2026-01-02T10:00:00Z',7.2,0.25,0,12.5,NULL);",
        )
        .unwrap();
        init_schema(&mut conn).unwrap();
        assert_eq!(user_version(&conn).unwrap(), 4);
        assert_eq!(list_readings_by_tank(&conn, "t1").unwrap().len(), 1);
        assert!(table_exists(&conn, "plant_checks"));
    }

    #[test]
    fn plants_and_checks_round_trip() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&mut conn).unwrap();
        create_tank(&conn, "T".into(), None, "t1".into()).unwrap();

        let mut custom = plant("p2", "2026-03-01T00:00:00Z");
        custom.species_id = None;
        custom.name = "Mystery stem".into();
        custom.placement = "background".into();
        custom.note = Some("from a friend".into());
        let first = plant("p1", "2026-02-01T00:00:00Z");
        add_plant(&conn, &custom).unwrap();
        add_plant(&conn, &first).unwrap();
        // Oldest planted first.
        assert_eq!(
            list_plants_by_tank(&conn, "t1").unwrap(),
            vec![first.clone(), custom.clone()]
        );
        assert!(list_plants_by_tank(&conn, "other").unwrap().is_empty());

        let c1 = check("c1", "p1", "2026-02-10T00:00:00Z", "ok");
        let c2 = PlantCheck {
            symptoms: vec![],
            action: None,
            note: None,
            ..check("c2", "p1", "2026-02-05T00:00:00Z", "struggling")
        };
        add_plant_check(&conn, &c1).unwrap();
        add_plant_check(&conn, &c2).unwrap();
        // Oldest first; symptoms come back as a list.
        assert_eq!(
            list_plant_checks_by_tank(&conn, "t1").unwrap(),
            vec![c2.clone(), c1.clone()]
        );

        // Removing keeps the row; restoring clears removedAt.
        let removed = Plant {
            removed_at: Some("2026-03-05T00:00:00Z".into()),
            ..first.clone()
        };
        update_plant(&conn, &removed).unwrap();
        assert_eq!(list_plants_by_tank(&conn, "t1").unwrap()[0], removed);
        update_plant(&conn, &first).unwrap();
        assert_eq!(list_plants_by_tank(&conn, "t1").unwrap()[0], first);

        // JSON uses the camelCase keys the web side sends, with null for missing values.
        let json = serde_json::to_value(&custom).unwrap();
        assert_eq!(json["tankId"], "t1");
        assert!(json["speciesId"].is_null() && json["removedAt"].is_null());
        let back: Plant = serde_json::from_value(json).unwrap();
        assert_eq!(back, custom);
        let from_web: PlantCheck = serde_json::from_str(
            r#"{"id":"c9","plantId":"p1","tankId":"t1","ts":"2026-02-01T00:00:00Z","health":"ok","symptoms":[]}"#,
        )
        .unwrap();
        assert!(from_web.action.is_none() && from_web.note.is_none());
    }

    #[test]
    fn deleting_a_plant_deletes_its_checks_only() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&mut conn).unwrap();
        create_tank(&conn, "T".into(), None, "t1".into()).unwrap();
        add_plant(&conn, &plant("p1", "2026-02-01T00:00:00Z")).unwrap();
        add_plant(&conn, &plant("p2", "2026-02-02T00:00:00Z")).unwrap();
        add_plant_check(&conn, &check("c1", "p1", "2026-02-10T00:00:00Z", "ok")).unwrap();
        add_plant_check(&conn, &check("c2", "p2", "2026-02-11T00:00:00Z", "ok")).unwrap();

        delete_plant(&conn, "p1").unwrap();

        let plants = list_plants_by_tank(&conn, "t1").unwrap();
        assert_eq!(plants.len(), 1);
        assert_eq!(plants[0].id, "p2");
        let checks = list_plant_checks_by_tank(&conn, "t1").unwrap();
        assert_eq!(checks.len(), 1);
        assert_eq!(checks[0].id, "c2");
    }

    #[test]
    fn archiving_a_tank_keeps_its_plants_like_its_readings() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&mut conn).unwrap();
        create_tank(&conn, "T".into(), None, "t1".into()).unwrap();
        add_reading(
            &conn,
            &reading("r1", "2026-01-01T00:00:00Z", Some(7.0), None),
        )
        .unwrap();
        add_plant(&conn, &plant("p1", "2026-02-01T00:00:00Z")).unwrap();
        add_plant_check(&conn, &check("c1", "p1", "2026-02-10T00:00:00Z", "ok")).unwrap();

        archive_tank(&conn, "t1").unwrap();

        assert!(list_tanks(&conn).unwrap()[0].archived_at.is_some());
        assert_eq!(list_readings_by_tank(&conn, "t1").unwrap().len(), 1);
        assert_eq!(list_plants_by_tank(&conn, "t1").unwrap().len(), 1);
        assert_eq!(list_plant_checks_by_tank(&conn, "t1").unwrap().len(), 1);
    }

    #[test]
    fn export_and_import_carry_plants_and_older_dumps_still_import() {
        let mut source = Connection::open_in_memory().unwrap();
        init_schema(&mut source).unwrap();
        create_tank(&source, "T".into(), None, "t1".into()).unwrap();
        add_plant(&source, &plant("p1", "2026-02-01T00:00:00Z")).unwrap();
        add_plant_check(&source, &check("c1", "p1", "2026-02-10T00:00:00Z", "ok")).unwrap();
        let dump = export_dump(&source).unwrap();
        assert_eq!(dump.plants.len(), 1);
        assert_eq!(
            dump.plant_checks[0].symptoms,
            vec!["pinholes", "brown-edges"]
        );

        // Through JSON, as the web side sends it, into an empty database.
        let json = serde_json::to_string(&dump).unwrap();
        assert!(json.contains("\"plantChecks\""));
        let parsed: Dump = serde_json::from_str(&json).unwrap();
        let mut target = Connection::open_in_memory().unwrap();
        init_schema(&mut target).unwrap();
        import_dump(&mut target, &parsed).unwrap();
        assert_eq!(list_plants_by_tank(&target, "t1").unwrap(), dump.plants);
        assert_eq!(
            list_plant_checks_by_tank(&target, "t1").unwrap(),
            dump.plant_checks
        );
        // Importing twice upserts instead of failing.
        import_dump(&mut target, &parsed).unwrap();
        assert_eq!(list_plants_by_tank(&target, "t1").unwrap().len(), 1);

        // A backup made before plants existed has neither key.
        let old: Dump = serde_json::from_str(
            r#"{"tanks":[{"id":"t9","name":"Old","createdAt":"2025-01-01T00:00:00Z","archivedAt":null,"reminderCadence":null}],"readings":[]}"#,
        )
        .unwrap();
        assert!(old.plants.is_empty() && old.plant_checks.is_empty());
        import_dump(&mut target, &old).unwrap();
        assert_eq!(list_plants_by_tank(&target, "t1").unwrap().len(), 1);
    }

    fn group(id: &str, species: Option<&str>, count: i64, added_at: &str) -> StockGroup {
        StockGroup {
            id: id.into(),
            tank_id: "t1".into(),
            species_id: species.map(|v| v.into()),
            name: "Neon tetra".into(),
            count,
            added_at: added_at.into(),
            removed_at: None,
            note: None,
        }
    }

    fn event(id: &str, stock_id: Option<&str>, kind: &str, delta: Option<i64>) -> StockEvent {
        StockEvent {
            id: id.into(),
            tank_id: "t1".into(),
            stock_id: stock_id.map(|v| v.into()),
            ts: "2026-09-20T08:00:00Z".into(),
            kind: kind.into(),
            count_delta: delta,
            health: None,
            note: None,
        }
    }

    const V3_SCHEMA: &str = r#"
    CREATE TABLE tanks (id TEXT PRIMARY KEY, name TEXT NOT NULL, createdAt TEXT NOT NULL, archivedAt TEXT, reminderCadence INTEGER);
    CREATE TABLE readings (
      id TEXT PRIMARY KEY, tankId TEXT NOT NULL, ts TEXT NOT NULL,
      pH REAL, ammonia REAL, nitrite REAL, nitrate REAL,
      note TEXT, FOREIGN KEY(tankId) REFERENCES tanks(id));
    CREATE INDEX readings_by_tank ON readings(tankId);
    CREATE INDEX readings_by_tank_ts ON readings(tankId, ts);
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE plants (id TEXT PRIMARY KEY, tankId TEXT NOT NULL, speciesId TEXT, name TEXT NOT NULL, placement TEXT NOT NULL, plantedAt TEXT NOT NULL, removedAt TEXT, note TEXT);
    CREATE TABLE plant_checks (id TEXT PRIMARY KEY, plantId TEXT NOT NULL, tankId TEXT NOT NULL, ts TEXT NOT NULL, health TEXT NOT NULL, symptoms TEXT NOT NULL DEFAULT '[]', action TEXT, note TEXT);
    PRAGMA user_version = 3;
    "#;

    #[test]
    fn fresh_db_has_stock_tables_and_volume_column() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&mut conn).unwrap();
        assert!(table_exists(&conn, "stock"));
        assert!(table_exists(&conn, "stock_events"));
        create_tank(&conn, "T".into(), None, "t1".into()).unwrap();
        assert_eq!(list_tanks(&conn).unwrap()[0].volume_l, None);
        set_tank_volume(&conn, "t1", Some(60.0)).unwrap();
        assert_eq!(list_tanks(&conn).unwrap()[0].volume_l, Some(60.0));
        set_tank_volume(&conn, "t1", None).unwrap();
        assert_eq!(list_tanks(&conn).unwrap()[0].volume_l, None);
    }

    #[test]
    fn migrates_v3_database_keeping_readings_and_plants() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(V3_SCHEMA).unwrap();
        conn.execute_batch(
            "INSERT INTO tanks VALUES ('t1','Main','2026-01-01T00:00:00Z',NULL,3);
             INSERT INTO readings VALUES ('r1','t1','2026-01-02T10:00:00Z',7.2,NULL,0,12.5,'first');
             INSERT INTO plants VALUES ('p1','t1','anubias-nana','Anubias nana','epiphyte','2026-02-01T00:00:00Z',NULL,NULL);
             INSERT INTO plant_checks VALUES ('c1','p1','t1','2026-02-10T00:00:00Z','ok','[]',NULL,NULL);",
        )
        .unwrap();
        assert!(!table_exists(&conn, "stock"));
        let readings = list_readings_by_tank(&conn, "t1").unwrap();
        let plants = list_plants_by_tank(&conn, "t1").unwrap();

        init_schema(&mut conn).unwrap();

        assert_eq!(user_version(&conn).unwrap(), 4);
        assert_eq!(list_readings_by_tank(&conn, "t1").unwrap(), readings);
        assert_eq!(list_plants_by_tank(&conn, "t1").unwrap(), plants);
        assert_eq!(list_plant_checks_by_tank(&conn, "t1").unwrap().len(), 1);
        let tanks = list_tanks(&conn).unwrap();
        assert_eq!(tanks[0].reminder_cadence, Some(3));
        assert_eq!(tanks[0].volume_l, None);

        add_stock(&conn, &group("g1", Some("neon-tetra"), 6, "2026-09-01T00:00:00Z")).unwrap();
        init_schema(&mut conn).unwrap();
        assert_eq!(list_stock_by_tank(&conn, "t1").unwrap().len(), 1);
    }

    #[test]
    fn stock_and_events_round_trip() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&mut conn).unwrap();
        create_tank(&conn, "T".into(), None, "t1".into()).unwrap();
        let mut custom = group("g2", None, 2, "2026-09-03T00:00:00Z");
        custom.name = "Mystery pleco".into();
        custom.note = Some("from a friend".into());
        let neons = group("g1", Some("neon-tetra"), 6, "2026-09-01T00:00:00Z");
        add_stock(&conn, &custom).unwrap();
        add_stock(&conn, &neons).unwrap();
        // Oldest added first.
        assert_eq!(
            list_stock_by_tank(&conn, "t1").unwrap(),
            vec![neons.clone(), custom.clone()]
        );
        assert!(list_stock_by_tank(&conn, "other").unwrap().is_empty());

        let removed = StockGroup {
            removed_at: Some("2026-09-10T00:00:00Z".into()),
            ..neons.clone()
        };
        update_stock(&conn, &removed).unwrap();
        assert_eq!(list_stock_by_tank(&conn, "t1").unwrap()[0], removed);
        update_stock(&conn, &neons).unwrap();
        assert_eq!(list_stock_by_tank(&conn, "t1").unwrap()[0], neons);

        // A whole-tank event has no stock id.
        let fed = event("e1", None, "fed", None);
        let saved = add_stock_event(&conn, &fed).unwrap();
        assert_eq!(saved, fed);
        assert_eq!(list_stock_events_by_tank(&conn, "t1").unwrap(), vec![fed]);

        let json = serde_json::to_value(&custom).unwrap();
        assert_eq!(json["tankId"], "t1");
        assert!(json["removedAt"].is_null() && json["speciesId"].is_null());
        let from_web: StockEvent = serde_json::from_str(
            r#"{"id":"e9","tankId":"t1","stockId":null,"ts":"2026-09-01T00:00:00Z","kind":"fed"}"#,
        )
        .unwrap();
        assert!(from_web.count_delta.is_none() && from_web.health.is_none());
    }

    #[test]
    fn count_events_adjust_the_group_in_one_transaction() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&mut conn).unwrap();
        create_tank(&conn, "T".into(), None, "t1".into()).unwrap();
        add_stock(&conn, &group("g1", Some("neon-tetra"), 6, "2026-09-01T00:00:00Z")).unwrap();
        let current = |conn: &Connection| list_stock_by_tank(conn, "t1").unwrap()[0].clone();

        let saved = add_stock_event(&conn, &event("e1", Some("g1"), "lost", Some(2))).unwrap();
        assert_eq!(saved.count_delta, Some(-2));
        assert_eq!(current(&conn).count, 4);

        add_stock_event(&conn, &event("e2", Some("g1"), "rehomed", Some(1))).unwrap();
        assert_eq!(current(&conn).count, 3);

        // Losing more than remain stops at 0, records what was applied, and removes the group.
        let saved = add_stock_event(&conn, &event("e3", Some("g1"), "lost", Some(5))).unwrap();
        assert_eq!(saved.count_delta, Some(-3));
        let g = current(&conn);
        assert_eq!(g.count, 0);
        assert_eq!(g.removed_at.as_deref(), Some("2026-09-20T08:00:00Z"));

        // Adding animals back restores it.
        add_stock_event(&conn, &event("e4", Some("g1"), "added", Some(4))).unwrap();
        let g = current(&conn);
        assert_eq!(g.count, 4);
        assert_eq!(g.removed_at, None);

        // Observations do not touch the count.
        let mut obs = event("e5", Some("g1"), "health", None);
        obs.health = Some("concern".into());
        add_stock_event(&conn, &obs).unwrap();
        assert_eq!(current(&conn).count, 4);
        assert_eq!(list_stock_events_by_tank(&conn, "t1").unwrap().len(), 5);

        // A failing event changes nothing: no count, no event row.
        assert!(add_stock_event(&conn, &event("e6", Some("g1"), "lost", None)).is_err());
        assert!(add_stock_event(&conn, &event("e7", Some("missing"), "lost", Some(1))).is_err());
        assert_eq!(current(&conn).count, 4);
        assert_eq!(list_stock_events_by_tank(&conn, "t1").unwrap().len(), 5);
    }

    #[test]
    fn deleting_a_group_deletes_its_events_only() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_schema(&mut conn).unwrap();
        create_tank(&conn, "T".into(), None, "t1".into()).unwrap();
        add_stock(&conn, &group("g1", Some("neon-tetra"), 6, "2026-09-01T00:00:00Z")).unwrap();
        add_stock(&conn, &group("g2", Some("guppy"), 3, "2026-09-02T00:00:00Z")).unwrap();
        add_stock_event(&conn, &event("e1", Some("g1"), "observed", None)).unwrap();
        add_stock_event(&conn, &event("e2", Some("g2"), "observed", None)).unwrap();
        add_stock_event(&conn, &event("e3", None, "fed", None)).unwrap();

        delete_stock(&conn, "g1").unwrap();

        assert_eq!(list_stock_by_tank(&conn, "t1").unwrap().len(), 1);
        let ids: Vec<String> = list_stock_events_by_tank(&conn, "t1")
            .unwrap()
            .into_iter()
            .map(|e| e.id)
            .collect();
        assert_eq!(ids, vec!["e2", "e3"]);
    }

    #[test]
    fn export_and_import_carry_stock_and_older_dumps_still_import() {
        let mut source = Connection::open_in_memory().unwrap();
        init_schema(&mut source).unwrap();
        create_tank(&source, "T".into(), None, "t1".into()).unwrap();
        set_tank_volume(&source, "t1", Some(75.5)).unwrap();
        add_plant(&source, &plant("p1", "2026-02-01T00:00:00Z")).unwrap();
        add_stock(&source, &group("g1", Some("neon-tetra"), 6, "2026-09-01T00:00:00Z")).unwrap();
        add_stock_event(&source, &event("e1", Some("g1"), "lost", Some(1))).unwrap();
        add_stock_event(&source, &event("e2", None, "fed", None)).unwrap();
        let dump = export_dump(&source).unwrap();
        assert_eq!(dump.stock.len(), 1);
        assert_eq!(dump.stock_events.len(), 2);
        assert_eq!(dump.tanks[0].volume_l, Some(75.5));

        let json = serde_json::to_string(&dump).unwrap();
        assert!(json.contains("\"stockEvents\""));
        let parsed: Dump = serde_json::from_str(&json).unwrap();
        let mut target = Connection::open_in_memory().unwrap();
        init_schema(&mut target).unwrap();
        import_dump(&mut target, &parsed).unwrap();
        import_dump(&mut target, &parsed).unwrap(); // upserts
        assert_eq!(list_stock_by_tank(&target, "t1").unwrap(), dump.stock);
        assert_eq!(list_stock_events_by_tank(&target, "t1").unwrap().len(), 2);
        assert_eq!(list_tanks(&target).unwrap()[0].volume_l, Some(75.5));

        // A backup made before stock existed has neither key, and no tank volume.
        let old: Dump = serde_json::from_str(
            r#"{"tanks":[{"id":"t9","name":"Old","createdAt":"2025-01-01T00:00:00Z","archivedAt":null,"reminderCadence":null}],"readings":[],"plants":[],"plantChecks":[]}"#,
        )
        .unwrap();
        assert!(old.stock.is_empty() && old.stock_events.is_empty());
        import_dump(&mut target, &old).unwrap();
        assert_eq!(list_stock_by_tank(&target, "t1").unwrap().len(), 1);
    }
}
