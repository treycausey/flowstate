//! SQLite storage for the desktop app. Kept free of Tauri types so it can be unit tested
//! against an in-memory connection.

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

/// Schema version stored in `PRAGMA user_version`.
/// 0: original schema (metric columns NOT NULL; the version was never set).
/// 2: metric columns nullable, so a reading can leave metrics untested.
pub const SCHEMA_VERSION: i64 = 2;

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

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Settings {
    pub units: Option<String>,
    pub theme: Option<String>,
    #[serde(rename = "chartOptions")]
    pub chart_options: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Dump {
    pub tanks: Vec<Tank>,
    pub readings: Vec<Reading>,
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
    if readings_table_exists(&tx)? {
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
    } else {
        tx.execute_batch(&format!("{};", CREATE_READINGS))?;
    }
    tx.execute_batch(CREATE_INDEXES)?;
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
    })
}

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
    let mut stmt = conn.prepare(
        "SELECT id, name, createdAt, archivedAt, reminderCadence FROM tanks ORDER BY createdAt ASC",
    )?;
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
        .prepare("SELECT id, name, createdAt, archivedAt, reminderCadence FROM tanks")
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
    let settings = get_settings(conn)?;
    Ok(Dump {
        tanks,
        readings,
        settings,
    })
}

pub fn import_dump(conn: &mut Connection, dump: &Dump) -> Result<(), String> {
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
        let before = export_dump(&conn).unwrap().readings;
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
}
