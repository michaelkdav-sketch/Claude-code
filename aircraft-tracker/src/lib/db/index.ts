import path from 'path'
import fs from 'fs'
import DatabaseConstructor, { type Database } from 'better-sqlite3'
import { initSchema } from './schema'

const DB_PATH = path.join(process.cwd(), 'data', 'aircraft.db')

let _db: Database | null = null

export function getDb(): Database {
  if (_db) return _db

  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  _db = new DatabaseConstructor(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('synchronous = NORMAL')
  _db.pragma('foreign_keys = ON')

  initSchema(_db)
  return _db
}
