import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { RUSLAN_S1_FIXTURE } from './fixtures/ruslanWorkedExample.js'
import { applyS1Parser } from './parsers/s1Parser.js'
import { applyS2Parser } from './parsers/s2Parser.js'
import { applyS4Parser } from './parsers/s4Parser.js'
import { buildS2HistoricalEnrichmentPrompt } from './prompts/s2HistoricalEnrichment.js'
import { buildS4EnvironmentalProjectionPrompt } from './prompts/s4EnvironmentalProjection.js'
import { runExtrapolationPipeline, runExtrapolationStage } from './orchestrator.js'
import { StageCache } from './stageCache.js'
import { createEntity, getEntity, listAttributes, listEntities, writeAttribute } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-extrapolation-test-'))
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

describe('extrapolation prompts and parsers', () => {
  it('parses Ruslan S1 fixture into expected entities and canon attrs', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'ruslan_levashov', type: 'character', name: 'Ruslan Levashov' })
    const applied = applyS1Parser(db, 'ruslan_levashov', RUSLAN_S1_FIXTURE)
    expect(applied.suggestions).toHaveLength(6)
    expect(applied.writes.filter((item) => item.entityId === 'ruslan_levashov').length).toBeGreaterThanOrEqual(12)
    const characters = listEntities(db, { type: 'character' })
    const environments = listEntities(db, { type: 'environment' })
    const institutions = listEntities(db, { type: 'institution' })
    expect(characters.length).toBeGreaterThanOrEqual(4)
    expect(environments.length).toBeGreaterThanOrEqual(2)
    expect(institutions.length).toBeGreaterThanOrEqual(1)
    expect(getEntity(db, 'rita_vlasova')?.name).toBe('Rita Vlasova')
    expect(listAttributes(db, { entityId: 'ruslan_levashov', provenance: 'canon' }).length).toBeGreaterThanOrEqual(12)
  })

  it('builds S2 prompt from era canon attrs', () => {
    const prompt = buildS2HistoricalEnrichmentPrompt({
      entity: { id: 'ent_1', name: 'Ruslan', type: 'character' },
      canonAttributes: [{ key: 'era.decade', value: '1990s' }],
      prior: {},
    })
    expect(prompt).toContain('Ruslan')
    expect(prompt).toContain('era.decade')
  })

  it('writes low-confidence inferred attrs from S2 parser', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'ent_s2', type: 'character', name: 'Ruslan' })
    const writes = applyS2Parser(db, 'ent_s2', {
      attributes: [{ key: 'wardrobe.jacket', value: 'worn student jacket', confidence: 0.9 }],
    })
    expect(writes).toHaveLength(1)
    expect(writes[0].confidence).toBeLessThanOrEqual(0.6)
    expect(writes[0].provenance).toBe('inferred')
  })

  it('creates environment entities from S4 parser', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'ent_s4', type: 'character', name: 'Ruslan' })
    const { writes, suggestions } = applyS4Parser(db, 'ent_s4', {
      environments: [{ name: 'Beer hall', summary: 'Friday hangout' }],
      attributes: [{ key: 'routine.friday', value: 'spends Fridays at beer hall with friends' }],
    })
    expect(suggestions).toHaveLength(1)
    expect(writes.some((item) => item.key === 'routine.friday')).toBe(true)
    const prompt = buildS4EnvironmentalProjectionPrompt({
      entity: { id: 'ent_s4', name: 'Ruslan', type: 'character' },
      canonAttributes: [],
      relationships: [],
      prior: {},
    })
    expect(prompt).toContain('environments')
  })
})

describe('extrapolation orchestrator', () => {
  it('runs stages sequentially and caches repeated input', async () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'ent_pipe', type: 'character', name: 'Ruslan' })
    writeAttribute(db, {
      entityId: 'ent_pipe',
      key: 'description',
      value: 'A student in 1990s Moscow.',
      provenance: 'canon',
      confidence: 1,
      sourceStage: 1,
    })

    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-extrapolation-cache-'))
    tempDirs.push(cacheDir)
    const cache = new StageCache({ cacheDir })
    const llm = async ({ user }) => {
      if (user.includes('period-specific')) {
        return JSON.stringify({ attributes: [{ key: 'culture.slang', value: 'bro', confidence: 0.5 }] })
      }
      if (user.includes('environments')) {
        return JSON.stringify({
          environments: [{ name: 'Communal apartment', summary: 'Shared kitchen' }],
          attributes: [{ key: 'home.context', value: 'lives in communal apartment' }],
        })
      }
      if (user.includes('psychology')) {
        return JSON.stringify({ attributes: [{ key: 'psychology.temperament', value: 'wry', confidence: 0.7 }] })
      }
      if (user.includes('frontal portrait')) {
        return JSON.stringify({ visualDescriptor: 'frontal portrait, neutral expression' })
      }
      return '{}'
    }

    const first = await runExtrapolationStage({
      db,
      entityId: 'ent_pipe',
      stageId: 2,
      llm,
      cache,
    })
    const second = await runExtrapolationStage({
      db,
      entityId: 'ent_pipe',
      stageId: 2,
      llm: async () => {
        throw new Error('should not call llm on cache hit')
      },
      cache,
    })
    expect(first.cacheHit).toBe(false)
    expect(second.cacheHit).toBe(true)

    const result = await runExtrapolationPipeline({
      db,
      entityId: 'ent_pipe',
      llm,
      cache,
    })
    expect(result.cancelled).toBe(false)
    expect(result.stages).toHaveLength(6)
    expect(result.stages.map((item) => item.stageId)).toEqual([1, 2, 3, 4, 5, 6])
  })
})
