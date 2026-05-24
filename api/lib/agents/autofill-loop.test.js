import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runAutofillLoop } from './autofill-loop.js'
import { createEntity, listAttributes } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { StageCache } from '../extrapolation/stageCache.js'

const tempDirs = []
/** @type {import('better-sqlite3').Database | null} */
let activeDb = null

function makeIsolatedCache() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-autofill-loop-cache-'))
  tempDirs.push(dir)
  return new StageCache({ cacheDir: dir })
}

function openTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-autofill-loop-'))
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

const s1DescriptionPayload = JSON.stringify({
  primary: { attributes: [{ key: 'description', value: 'Filled by autofill loop.' }] },
  entities: [],
})

describe('runAutofillLoop', () => {
  it('terminates with complete when gaps are filled (full-fill)', async () => {
    const db = openTempDb()
    createEntity(db, { id: 'ent_fill', type: 'character', name: 'Hero' })
    const llm = vi.fn(async () => s1DescriptionPayload)
    const events = []
    const out = await runAutofillLoop({
      db,
      entityId: 'ent_fill',
      llm,
      cache: makeIsolatedCache(),
      detectGaps: (gapDb, gapEntityId) => {
        const keys = new Set(listAttributes(gapDb, { entityId: gapEntityId }).map((a) => a.key))
        return keys.has('description')
          ? []
          : [{ field: 'description', severity: 'high', suggestedStageId: 1 }]
      },
      onEvent: (e) => events.push(e.type),
    })
    expect(out.terminationReason).toBe('complete')
    expect(out.gapsRemaining).toBe(0)
    expect(out.gapsResolved).toBeGreaterThanOrEqual(1)
    expect(out.iterations).toBe(1)
    expect(events).toContain('run:start')
    expect(events).toContain('iter:start')
    expect(events).toContain('iter:end')
    expect(events.filter((t) => t === 'run:end')).toHaveLength(1)
    const desc = listAttributes(db, { entityId: 'ent_fill', key: 'description' })
    expect(desc.length).toBeGreaterThan(0)
  })

  it('terminates with budget when token spend exceeds budget (partial-fill-with-budget)', async () => {
    const db = openTempDb()
    createEntity(db, { id: 'ent_budget', type: 'character', name: 'Hero' })
    const llm = vi.fn(async () => s1DescriptionPayload)
    const out = await runAutofillLoop({
      db,
      entityId: 'ent_budget',
      llm,
      cache: makeIsolatedCache(),
      detectGaps: (gapDb, gapEntityId) => {
        const keys = new Set(listAttributes(gapDb, { entityId: gapEntityId }).map((a) => a.key))
        return keys.has('description')
          ? []
          : [{ field: 'description', severity: 'high', suggestedStageId: 1 }]
      },
      budgetTokens: 1,
      meterLlmCall: () => 500,
    })
    expect(out.terminationReason).toBe('budget')
    expect(out.iterations).toBe(1)
  })

  it('skips unfillable gap after a failed run-stage and completes without looping (unfillable-gap-skipped)', async () => {
    const db = openTempDb()
    createEntity(db, { id: 'ent_bad', type: 'character', name: 'Hero' })
    const llm = vi.fn(async () => {
      throw new Error('simulated LLM failure')
    })
    const out = await runAutofillLoop({
      db,
      entityId: 'ent_bad',
      llm,
      cache: makeIsolatedCache(),
      detectGaps: () => [{ field: 'description', severity: 'high', suggestedStageId: 1 }],
      maxIterations: 6,
    })
    expect(out.terminationReason).toBe('complete')
    expect(out.iterations).toBe(1)
    expect(out.gapsRemaining).toBeGreaterThan(0)
    expect(out.gapsResolved).toBe(0)
  })

  it('terminates with max-iterations when maxIterations is 0 and gaps exist', async () => {
    const db = openTempDb()
    createEntity(db, { id: 'ent_cap', type: 'character', name: 'Hero' })
    const out = await runAutofillLoop({
      db,
      entityId: 'ent_cap',
      llm: vi.fn(async () => s1DescriptionPayload),
      cache: makeIsolatedCache(),
      detectGaps: () => [{ field: 'description', severity: 'high', suggestedStageId: 1 }],
      maxIterations: 0,
    })
    expect(out.terminationReason).toBe('max-iterations')
    expect(out.iterations).toBe(0)
    expect(out.gapsRemaining).toBeGreaterThan(0)
  })
})
