import aiosqlite
from config import settings

_DB_PATH = settings.db_path

CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    notify INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS person_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    photo_path TEXT NOT NULL,
    embedding TEXT
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ring_event_id TEXT UNIQUE NOT NULL,
    device_id TEXT,
    kind TEXT,
    created_at TEXT NOT NULL,
    snapshot_path TEXT,
    person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
    confidence REAL,
    label_override TEXT
);
"""


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(_DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys = ON")
    return db


async def init_db():
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.executescript(CREATE_TABLES)
        await db.commit()
