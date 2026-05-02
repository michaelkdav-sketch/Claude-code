#!/usr/bin/env node
// Downloads and imports the FAA aircraft registration database into SQLite.
//
// Usage:
//   node scripts/import-faa.mjs
//
// The FAA publishes a monthly CSV snapshot at:
//   https://registry.faa.gov/database/ReleasableAircraft.zip
// This script downloads it, extracts MASTER.txt, and bulk-loads it.
//
// Run once manually; re-run monthly to refresh.

import { createWriteStream, createReadStream } from 'fs'
import { mkdir, rm, readdir } from 'fs/promises'
import { createInterface } from 'readline'
import { pipeline } from 'stream/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { unzipSync } from 'zlib'
import { readFileSync, writeFileSync } from 'fs'
import Database from 'better-sqlite3'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DB_PATH = join(ROOT, 'aircraft.db')
const TMP_DIR = join(ROOT, '.faa-tmp')
const ZIP_URL = 'https://registry.faa.gov/database/ReleasableAircraft.zip'
const ZIP_PATH = join(TMP_DIR, 'faa.zip')

async function download(url, dest) {
  console.log(`Downloading ${url} …`)
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  await pipeline(res.body, createWriteStream(dest))
  console.log('Download complete.')
}

function extractMaster(zipPath, destDir) {
  console.log('Extracting MASTER.txt …')
  // Use system unzip for large files — simpler than streaming JSzip
  const { execSync } = await import('child_process').catch(() => { throw new Error('need child_process') })
  execSync(`unzip -o "${zipPath}" MASTER.txt -d "${destDir}"`, { stdio: 'inherit' })
}

async function importCsv(csvPath, db) {
  console.log('Importing rows …')

  db.exec(`DELETE FROM faa_registrations`)
  const insert = db.prepare(
    `INSERT OR REPLACE INTO faa_registrations (registration, owner, aircraft_mfr, aircraft_model, state)
     VALUES (?, ?, ?, ?, ?)`
  )
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(r)
  })

  const rl = createInterface({ input: createReadStream(csvPath), crlfDelay: Infinity })
  let header = true
  let batch = []
  let total = 0

  for await (const line of rl) {
    if (header) { header = false; continue }
    const cols = line.split(',')
    // MASTER.txt columns: N-NUMBER, SERIAL NUMBER, MFR MDL CODE, ENG MFR CODE, YEAR MFR,
    // TYPE REGISTRANT, NAME, STREET, STREET2, CITY, STATE, ZIP CODE, REGION, ...
    const reg = 'N' + (cols[0] ?? '').trim()
    const owner = (cols[6] ?? '').trim() || null
    const mfr = (cols[2] ?? '').trim() || null // MFR MDL CODE — not ideal but available
    const state = (cols[10] ?? '').trim() || null
    if (!cols[0]?.trim()) continue
    batch.push([reg, owner, mfr, null, state])
    if (batch.length >= 5000) {
      insertMany(batch)
      total += batch.length
      batch = []
      process.stdout.write(`\r  ${total.toLocaleString()} rows inserted…`)
    }
  }

  if (batch.length) {
    insertMany(batch)
    total += batch.length
  }

  console.log(`\nDone — ${total.toLocaleString()} registrations imported.`)
}

async function main() {
  await mkdir(TMP_DIR, { recursive: true })

  try {
    await download(ZIP_URL, ZIP_PATH)

    // Unzip using child_process
    const { execSync } = (await import('child_process'))
    execSync(`unzip -o "${ZIP_PATH}" MASTER.txt -d "${TMP_DIR}"`, { stdio: 'inherit' })

    const csvPath = join(TMP_DIR, 'MASTER.txt')
    const db = new Database(DB_PATH)

    // Ensure table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS faa_registrations (
        registration   TEXT PRIMARY KEY,
        owner          TEXT,
        aircraft_mfr   TEXT,
        aircraft_model TEXT,
        state          TEXT
      )
    `)

    await importCsv(csvPath, db)
    db.close()
  } finally {
    await rm(TMP_DIR, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
