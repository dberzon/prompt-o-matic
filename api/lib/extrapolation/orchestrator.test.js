import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as repositories from '../db/repositories.js'
import { createProgressBus } from './progress-bus.js'
import { runExtrapolationPipeline } from './orchestrator.js'
import { chainFor, UnknownExtrapolationEntityTypeError } from './stageRegistry.js'
import { extrapolationStages } from './stages.js'
import { StageCache } from './stageCache.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-orchestrator-test-'))
  tempDirs.push(dir)
  return path.join(dir, 'test.sqlite')
}

function ensureDb(dbPath) {
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

/** Read entity without calling `getEntity` (avoids recursion when spying that export). */
function readEntityRow(db, id) {
  const row = db.prepare('SELECT * FROM entities WHERE id = ?').get(id)
  if (!row) return null
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    projectId: row.project_id ?? null,
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

afterEach(() => {
  while (openDbs.length > 0) {
    try {
      openDbs.pop().close()
    } catch {}
  }
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('stageRegistry chainFor', () => {
  it('returns the live character extrapolationStages array (byte-stable hook)', () => {
    expect(chainFor('character')).toBe(extrapolationStages)
    expect(chainFor('environment')).toBe(extrapolationStages)
    expect(chainFor('prop')).toBe(extrapolationStages)
    expect(chainFor('institution')).toBe(extrapolationStages)
  })

  it('matches snapshot of character stage id + name metadata', () => {
    expect(chainFor('character').map(({ id, name }) => ({ id, name }))).toMatchSnapshot()
  })

  it('exposes location geography chain and placeholder era chain', () => {
    const loc = chainFor('location')
    const era = chainFor('era')
    expect(loc).toHaveLength(3)
    expect(era).toHaveLength(6)
    expect(loc.map((s) => s.id)).toEqual([1, 2, 3])
    expect(era.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6])
    expect(loc[0]).not.toBe(extrapolationStages[0])
    expect(loc[0].run).not.toBe(loc[1].run)
  })

  it('throws UnknownExtrapolationEntityTypeError for unregistered types', () => {
    expect(() => chainFor('vessel')).toThrow(UnknownExtrapolationEntityTypeError)
    try {
      chainFor('unknown_kind')
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownExtrapolationEntityTypeError)
      expect(e.code).toBe('UNKNOWN_EXTRAPOLATION_ENTITY_TYPE')
      expect(e.status).toBe(400)
    }
  })
})

describe('orchestrator entity-type dispatch', () => {
  it('runs mock location chain with three LLM calls', async () => {
    const db = ensureDb(createTempDbPath())
    repositories.createEntity(db, { id: 'ent_loc', type: 'character', name: 'Red Square' })
    repositories.writeAttribute(db, {
      entityId: 'ent_loc',
      key: 'identity.summary',
      value: 'A public square.',
      provenance: 'canon',
      confidence: 1,
      sourceStage: null,
    })

    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-orchestrator-loc-'))
    tempDirs.push(cacheDir)
    const cache = new StageCache({ cacheDir })

    const spy = vi.spyOn(repositories, 'getEntity').mockImplementation((d, id) => {
      const row = readEntityRow(d, id)
      if (id === 'ent_loc' && row) return { ...row, type: 'location' }
      return row
    })

    let llmCalls = 0
    const llm = async ({ user }) => {
      llmCalls += 1
      if (user.includes('Infer geography for a filming location')) {
        return JSON.stringify({ placement: 'Urban core', architecturalNotes: 'Stone paving' })
      }
      if (user.includes('Infer recurring inhabitants')) {
        return JSON.stringify({ inhabitants: ['tourists'] })
      }
      if (user.includes('Infer historical / atmospheric context')) {
        return JSON.stringify({ weather: 'clear', sensoryAtmosphere: 'crowd noise' })
      }
      return '{}'
    }

    const pipeline = await runExtrapolationPipeline({ db, entityId: 'ent_loc', llm, cache, parallelMiddleStages: false })
    spy.mockRestore()

    expect(pipeline.cancelled).toBe(false)
    expect(llmCalls).toBe(3)
    expect(pipeline.stages).toHaveLength(3)
    expect(pipeline.stages.map((s) => s.stageId)).toEqual([1, 2, 3])
    expect(pipeline.stages[0].writes.length).toBeGreaterThan(0)
  })

  it('runs mock era chain without calling llm', async () => {
    const db = ensureDb(createTempDbPath())
    repositories.createEntity(db, { id: 'ent_era', type: 'character', name: '1991' })
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-orchestrator-era-'))
    tempDirs.push(cacheDir)
    const cache = new StageCache({ cacheDir })

    const spy = vi.spyOn(repositories, 'getEntity').mockImplementation((d, id) => {
      const row = readEntityRow(d, id)
      if (id === 'ent_era' && row) return { ...row, type: 'era' }
      return row
    })

    let llmCalls = 0
    const llm = async () => {
      llmCalls += 1
      return '{}'
    }

    const pipeline = await runExtrapolationPipeline({ db, entityId: 'ent_era', llm, cache })
    spy.mockRestore()

    expect(pipeline.cancelled).toBe(false)
    expect(llmCalls).toBe(0)
    expect(pipeline.stages.map((s) => s.stageId)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('rejects pipeline when entity type has no registered chain', async () => {
    const db = ensureDb(createTempDbPath())
    repositories.createEntity(db, { id: 'ent_bad', type: 'character', name: 'X' })
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-orchestrator-bad-'))
    tempDirs.push(cacheDir)
    const spy = vi.spyOn(repositories, 'getEntity').mockImplementation((d, id) => {
      const row = readEntityRow(d, id)
      if (id === 'ent_bad' && row) return { ...row, type: 'vessel' }
      return row
    })

    await expect(
      runExtrapolationPipeline({
        db,
        entityId: 'ent_bad',
        llm: async () => '{}',
        cache: new StageCache({ cacheDir }),
      }),
    ).rejects.toMatchObject({ code: 'UNKNOWN_EXTRAPOLATION_ENTITY_TYPE' })

    spy.mockRestore()
  })
})

describe('orchestrator S6 conflict persistence', () => {
  it('writes suggested conflict markers from prompt-shaped S6 output', async () => {
    const db = ensureDb(createTempDbPath())
    repositories.createEntity(db, { id: 'ent_s6', type: 'character', name: 'Ruslan' })
    repositories.writeAttribute(db, {
      entityId: 'ent_s6',
      key: 'description',
      value: 'A student in 1990s Moscow.',
      provenance: 'canon',
      confidence: 1,
      sourceStage: 1,
    })
    const first = repositories.writeAttribute(db, {
      entityId: 'ent_s6',
      key: 'eyes',
      value: 'green',
      provenance: 'inferred',
      confidence: 0.6,
      sourceStage: 3,
    })
    const second = repositories.writeAttribute(db, {
      entityId: 'ent_s6',
      key: 'eyes',
      value: 'blue',
      provenance: 'inferred',
      confidence: 0.6,
      sourceStage: 5,
    })

    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-orchestrator-cache-'))
    tempDirs.push(cacheDir)
    const cache = new StageCache({ cacheDir })

    const llm = async ({ user }) => {
      if (user.includes('Extract entities and canon attributes')) {
        return JSON.stringify({
          primary: { attributes: [{ key: 'name', value: 'Ruslan' }] },
          entities: [],
        })
      }
      if (user.includes('You enrich a fictional character with period-specific')) {
        return JSON.stringify({ attributes: [{ key: 'culture.slang', value: 'bro', confidence: 0.5 }] })
      }
      if (user.includes('Infer psychology attributes')) {
        return JSON.stringify({ attributes: [{ key: 'behavior.temperament', value: 'wry', confidence: 0.7 }] })
      }
      if (user.includes('Project likely environments')) {
        return JSON.stringify({
          environments: [{ name: 'Beer hall', summary: 'Hangout' }],
          attributes: [{ key: 'routine.friday', value: 'Fridays at hall' }],
        })
      }
      if (user.includes('Write a single visual descriptor')) {
        return JSON.stringify({ visualDescriptor: 'frontal portrait, neutral expression, plain backdrop' })
      }
      if (user.includes('Detect contradictions')) {
        return JSON.stringify({
          conflicts: [
            {
              key: 'eyes',
              message: 'Green vs blue eye color across stages',
              attributeIds: [first.id, second.id],
            },
          ],
        })
      }
      return '{}'
    }

    const stageSnapshots = []
    const pipeline = await runExtrapolationPipeline({
      db,
      entityId: 'ent_s6',
      llm,
      cache,
      onStageComplete: async (stageResult) => {
        stageSnapshots.push({
          stageId: stageResult.stageId,
          writes: [...(stageResult.writes || [])],
          dropped: [...(stageResult.dropped || [])],
        })
      },
    })

    expect(pipeline.cancelled).toBe(false)
    const s6 = pipeline.stages.find((s) => s.stageId === 6)
    expect(s6?.dropped || []).toEqual([])
    expect(s6?.writes?.length).toBe(1)
    expect(s6.writes[0]).toMatchObject({
      key: 'conflict.eyes',
      provenance: 'suggested',
      sourceStage: 6,
    })
    expect(s6.writes[0].value).toEqual({
      message: 'Green vs blue eye color across stages',
      attributeIds: [first.id, second.id],
    })

    const snap6 = stageSnapshots.find((s) => s.stageId === 6)
    expect(snap6?.writes?.length).toBe(1)
    expect(snap6?.dropped || []).toEqual([])

    const stored = repositories.listAttributes(db, { entityId: 'ent_s6', provenance: 'suggested' })
    expect(stored.some((row) => row.key === 'conflict.eyes')).toBe(true)
  })
})

describe('orchestrator dropped[] propagation', () => {
  it('onStageComplete receives non-empty dropped when parser drops schema-valid rows', async () => {
    const db = ensureDb(createTempDbPath())
    repositories.createEntity(db, { id: 'ent_drop', type: 'character', name: 'Ruslan' })
    repositories.writeAttribute(db, {
      entityId: 'ent_drop',
      key: 'description',
      value: 'A student in 1990s Moscow.',
      provenance: 'canon',
      confidence: 1,
      sourceStage: 1,
    })

    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-orchestrator-cache-'))
    tempDirs.push(cacheDir)
    const cache = new StageCache({ cacheDir })

    const llm = async ({ user }) => {
      if (user.includes('Extract entities and canon attributes')) {
        return JSON.stringify({
          primary: { attributes: [{ key: 'name', value: 'Ruslan' }] },
          entities: [],
        })
      }
      if (user.includes('You enrich a fictional character with period-specific')) {
        return JSON.stringify({ attributes: [{ key: 'culture.slang', value: 'bro', confidence: 0.5 }] })
      }
      if (user.includes('Infer psychology attributes')) {
        return JSON.stringify({ attributes: [{ key: 'behavior.temperament', value: 'wry', confidence: 0.7 }] })
      }
      if (user.includes('Project likely environments')) {
        return JSON.stringify({
          environments: [{ name: 'Beer hall', summary: 'Hangout' }],
          attributes: [{ key: 'routine.friday', value: 'Fridays at hall' }],
          // Schema-valid, but otherSlug slugifies to empty → parser drops.
          relationshipAttributes: [{ type: 'knows', otherSlug: '!!!', value: 'friend' }],
        })
      }
      if (user.includes('Write a single visual descriptor')) {
        return JSON.stringify({ visualDescriptor: 'frontal portrait, neutral expression, plain backdrop' })
      }
      if (user.includes('Detect contradictions')) {
        return JSON.stringify({ conflicts: [] })
      }
      return '{}'
    }

    const stageSnapshots = []
    const pipeline = await runExtrapolationPipeline({
      db,
      entityId: 'ent_drop',
      llm,
      cache,
      onStageComplete: async (stageResult) => {
        stageSnapshots.push({
          stageId: stageResult.stageId,
          dropped: [...(stageResult.dropped || [])],
        })
      },
    })

    expect(pipeline.cancelled).toBe(false)
    const s4 = pipeline.stages.find((s) => s.stageId === 4)
    expect(s4?.dropped?.length).toBeGreaterThan(0)
    expect(s4.dropped.some((d) => d.reason === 'relationship_other_slug_empty')).toBe(true)

    const snap4 = stageSnapshots.find((s) => s.stageId === 4)
    expect(snap4?.dropped?.length).toBeGreaterThan(0)
  })
})

describe('orchestrator progress bus', () => {
  it('emits ordered lifecycle events and closes the bus', async () => {
    const db = ensureDb(createTempDbPath())
    repositories.createEntity(db, { id: 'ent_prog', type: 'character', name: 'Red Square' })
    repositories.writeAttribute(db, {
      entityId: 'ent_prog',
      key: 'description',
      value: 'A public square.',
      provenance: 'canon',
      confidence: 1,
      sourceStage: 1,
    })

    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-orchestrator-prog-'))
    tempDirs.push(cacheDir)
    const cache = new StageCache({ cacheDir })

    const spy = vi.spyOn(repositories, 'getEntity').mockImplementation((d, id) => {
      const row = readEntityRow(d, id)
      if (id === 'ent_prog' && row) return { ...row, type: 'location' }
      return row
    })

    const bus = createProgressBus()
    const types = []
    bus.subscribe((e) => types.push(e.type))

    const llm = async ({ user }) => {
      if (user.includes('Infer geography for a filming location')) {
        return JSON.stringify({ placement: 'Urban core' })
      }
      if (user.includes('Infer recurring inhabitants')) {
        return JSON.stringify({ inhabitants: [] })
      }
      if (user.includes('Infer historical / atmospheric context')) {
        return JSON.stringify({ weather: 'mist' })
      }
      return '{}'
    }

    await runExtrapolationPipeline({
      db,
      entityId: 'ent_prog',
      llm,
      cache,
      parallelMiddleStages: false,
      progress: bus,
    })

    spy.mockRestore()

    expect(types[0]).toBe('run:start')
    expect(types[types.length - 1]).toBe('run:end')
    expect(types.filter((t) => t === 'stage:start').length).toBe(3)
    expect(types.filter((t) => t === 'stage:finish').length).toBe(3)
    expect(bus.closed).toBe(true)
  })
})
