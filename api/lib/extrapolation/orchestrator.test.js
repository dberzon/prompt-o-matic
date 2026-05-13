import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runExtrapolationPipeline } from './orchestrator.js'
import { StageCache } from './stageCache.js'
import { createEntity, writeAttribute } from '../db/repositories.js'
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

describe('orchestrator dropped[] propagation', () => {
  it('onStageComplete receives non-empty dropped when parser drops schema-valid rows', async () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'ent_drop', type: 'character', name: 'Ruslan' })
    writeAttribute(db, {
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
        })
      }
      if (user.includes('Write a single visual descriptor')) {
        return JSON.stringify({ visualDescriptor: 'frontal portrait, neutral expression, plain backdrop' })
      }
      if (user.includes('Detect contradictions')) {
        return JSON.stringify({
          conflicts: [
            {
              keys: ['wardrobe.jacket', 'behavior.temperament'],
              severity: 'low',
              reason: 'LLM reason field (no message) — parser drops until message contract aligns',
            },
          ],
        })
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
    const s6 = pipeline.stages.find((s) => s.stageId === 6)
    expect(s6?.dropped?.length).toBeGreaterThan(0)
    expect(s6.dropped.some((d) => d.reason === 'conflict_missing_message')).toBe(true)

    const snap6 = stageSnapshots.find((s) => s.stageId === 6)
    expect(snap6?.dropped?.length).toBeGreaterThan(0)
  })
})
