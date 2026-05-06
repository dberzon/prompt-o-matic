/**
 * One-time backfill: populate name, age, gender_presentation, cinematic_archetype
 * shadow columns on the characters table from existing payload_json data.
 *
 * Run once after deploying the H4 migration:
 *   node scripts/backfill-character-shadow-columns.mjs
 */

import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../data/qpb-local.sqlite')

const db = new Database(DB_PATH)

const rows = db.prepare('SELECT id, payload_json FROM characters').all()

const update = db.prepare(`
  UPDATE characters
  SET name = @name,
      age = @age,
      gender_presentation = @gender_presentation,
      cinematic_archetype = @cinematic_archetype
  WHERE id = @id
`)

const backfill = db.transaction(() => {
  let updated = 0
  let skipped = 0
  for (const row of rows) {
    let payload
    try {
      payload = JSON.parse(row.payload_json)
    } catch {
      console.warn(`Skipping id=${row.id}: invalid payload_json`)
      skipped++
      continue
    }
    update.run({
      id: row.id,
      name: payload.name ?? null,
      age: typeof payload.age === 'number' ? payload.age : null,
      gender_presentation: payload.genderPresentation ?? null,
      cinematic_archetype: payload.cinematicArchetype ?? null,
    })
    updated++
  }
  return { updated, skipped }
})

const result = backfill()
console.log(`Backfill complete: ${result.updated} updated, ${result.skipped} skipped`)

db.close()
