import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEntity, listAttributes, writeAttribute } from '../../../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../../../db/sqlite.js'
import { StageCache } from '../../stageCache.js'
import { runExtrapolationPipeline } from '../../orchestrator.js'

const tempDirs = []
/** @type {import('better-sqlite3').Database | null} */
let activeDb = null

function openTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-location-chain-'))
  tempDirs.push(dir)
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath: path.join(dir, 't.sqlite') })
  initializeDatabase(db)
  activeDb = db
  return db
}

afterEach(() => {
  if (activeDb) {
    try {
      activeDb.close()
    } catch {
      /* ignore */
    }
    activeDb = null
  }
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
  vi.restoreAllMocks()
})

function projectionSnapshot(db, entityId) {
  const attrs = listAttributes(db, { entityId })
  const sorted = [...attrs].sort((a, b) => String(a.key).localeCompare(String(b.key)))
  return sorted.map((a) => ({
    key: a.key,
    provenance: a.provenance,
    value: a.value,
    sourceStage: a.sourceStage,
  }))
}

describe('location stage chain', () => {
  it('fixture seed → full chain → non-empty Location projection (snapshot)', async () => {
    const db = openTempDb()
    const ent = createEntity(db, { id: 'loc_fixture_1', type: 'location', name: 'Canal-side warehouse' })
    writeAttribute(db, {
      entityId: ent.id,
      key: 'identity.name',
      value: 'Canal-side warehouse',
      provenance: 'canon',
      confidence: 1,
      sourceStage: null,
    })
    writeAttribute(db, {
      entityId: ent.id,
      key: 'identity.summary',
      value: 'Cold-storage warehouse used for night exteriors and rain-soaked confrontations.',
      provenance: 'canon',
      confidence: 1,
      sourceStage: null,
    })
    writeAttribute(db, {
      entityId: ent.id,
      key: 'function.purposeInStory',
      value: 'Anchor the second-act chase and the final standoff.',
      provenance: 'canon',
      confidence: 1,
      sourceStage: null,
    })
    writeAttribute(db, {
      entityId: ent.id,
      key: 'visuals.shotPriority',
      value: 'Wide on water, tight on rusted roller doors.',
      provenance: 'canon',
      confidence: 1,
      sourceStage: null,
    })
    writeAttribute(db, {
      entityId: ent.id,
      key: 'visuals.moodKeywords',
      value: ['industrial decay', 'wet concrete'],
      provenance: 'canon',
      confidence: 1,
      sourceStage: null,
    })

    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-loc-cache-'))
    tempDirs.push(cacheDir)
    const cache = new StageCache({ cacheDir })

    const llm = vi.fn(async ({ user }) => {
      if (user.includes('Infer geography for a filming location')) {
        return JSON.stringify({
          placement: 'East docklands, narrow canal with mossy quay and rusted mooring rings.',
          architecturalNotes: 'Corrugated roof, steel loading bay, broken skylight strips.',
        })
      }
      if (user.includes('Infer recurring inhabitants')) {
        return JSON.stringify({ inhabitants: ['night guard', 'dock workers union'] })
      }
      if (user.includes('Infer historical / atmospheric context')) {
        return JSON.stringify({
          eraOrPeriod: 'late 1990s post-industrial decline',
          weather: 'persistent drizzle',
          sensoryAtmosphere: 'diesel, wet wool, distant ship horn',
          periodFixtures: ['flicker sodium lamp', 'chained plastic curtain at bay door'],
        })
      }
      return JSON.stringify({})
    })

    const { cancelled } = await runExtrapolationPipeline({
      db,
      entityId: ent.id,
      llm,
      cache,
      parallelMiddleStages: false,
    })
    expect(cancelled).toBe(false)

    const snap = projectionSnapshot(db, ent.id)
    expect(snap.length).toBeGreaterThan(5)
    expect(snap.some((r) => r.key === 'geography.placement')).toBe(true)
    expect(snap.some((r) => r.key === 'inhabitants')).toBe(true)
    expect(snap.some((r) => r.key === 'weather')).toBe(true)

    const keys = snap.map((r) => r.key).sort()
    expect(keys).toContain('function.purposeInStory')
    expect(keys).toContain('geography.architecturalNotes')
    expect(keys).toContain('geography.placement')
    expect(keys).toContain('identity.name')
    expect(keys).toContain('identity.summary')
    expect(keys).toContain('inhabitants')
    expect(keys).toContain('periodFixtures')
    expect(keys).toContain('sensoryAtmosphere')
    expect(keys).toContain('visuals.moodKeywords')
    expect(keys).toContain('visuals.shotPriority')
    expect(keys).toContain('weather')
  })
})
