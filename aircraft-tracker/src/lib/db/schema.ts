import type { Database } from 'better-sqlite3'

export function initSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS aircraft_snapshots (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      hex           TEXT    NOT NULL,
      callsign      TEXT,
      type_code     TEXT,
      type_desc     TEXT,
      registration  TEXT,
      altitude_ft   INTEGER,
      on_ground     INTEGER NOT NULL DEFAULT 0,
      speed_kt      INTEGER,
      track_deg     REAL,
      lat           REAL,
      lon           REAL,
      squawk        TEXT,
      category      TEXT,
      distance_nm   REAL,
      bearing_deg   REAL,
      mil_score     INTEGER NOT NULL DEFAULT 0,
      mil_label     TEXT    NOT NULL DEFAULT 'unknown',
      mil_reasons   TEXT,
      source        TEXT    NOT NULL,
      fetched_at    INTEGER NOT NULL,
      raw_json      TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_snap_hex      ON aircraft_snapshots(hex);
    CREATE INDEX IF NOT EXISTS idx_snap_fetched  ON aircraft_snapshots(fetched_at);

    CREATE TABLE IF NOT EXISTS overhead_events (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      hex             TEXT    NOT NULL,
      callsign        TEXT,
      type_code       TEXT,
      type_desc       TEXT,
      first_seen      INTEGER NOT NULL,
      last_seen       INTEGER NOT NULL,
      closest_nm      REAL,
      max_altitude_ft INTEGER,
      mil_score       INTEGER NOT NULL DEFAULT 0,
      mil_label       TEXT    NOT NULL DEFAULT 'unknown',
      snapshot_count  INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_evt_hex       ON overhead_events(hex);
    CREATE INDEX IF NOT EXISTS idx_evt_first     ON overhead_events(first_seen);
    CREATE INDEX IF NOT EXISTS idx_evt_last      ON overhead_events(last_seen);

    CREATE TABLE IF NOT EXISTS poll_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}
