import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { RUSLAN_S1_FIXTURE } from './fixtures/ruslanWorkedExample.js'
import { applyS1Parser } from './parsers/s1Parser.js'
import { applyS2Parser } from './parsers/s2Parser.js'
import { applyS4Parser } from './parsers/s4Parser.js'
import { runExtrapolationPipeline, runExtrapolationStage } from './orchestrator.js'
import { StageCache } from './stageCache.js'
import {
  createEntity,
  dismissSuggested,
  getEntity,
  listAttributes,
  listEntities,
  writeAttribute,
} from '../db/repositories.js'
import { getPrompt } from '../prompts/registry.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { parseS6ConflictOutput } from './schemas/s6Conflict.js'
import { parseS2HistoricalOutput } from './schemas/s2Historical.js'
import { parseS3PsychologyOutput } from './schemas/s3Psychology.js'
import { parseS4EnvironmentOutput } from './schemas/s4Environment.js'
import { parseS5VisualDescriptorOutput } from './schemas/s5VisualDescriptor.js'

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

  it('S6 conflict schema accepts stub empty payload used by orchestrator LLM stubs', () => {
    expect(() => parseS6ConflictOutput({ conflicts: [] })).not.toThrow()
  })

  it('S2–S5 output schemas accept orchestrator happy-path stub payloads', () => {
    expect(() =>
      parseS2HistoricalOutput({ attributes: [{ key: 'culture.slang', value: 'bro', confidence: 0.5 }] }),
    ).not.toThrow()
    expect(() =>
      parseS3PsychologyOutput({ attributes: [{ key: 'behavior.temperament', value: 'wry', confidence: 0.7 }] }),
    ).not.toThrow()
    expect(() =>
      parseS4EnvironmentOutput({
        environments: [{ name: 'Communal apartment', summary: 'Shared kitchen' }],
        attributes: [{ key: 'home.context', value: 'lives in communal apartment' }],
      }),
    ).not.toThrow()
    expect(() => parseS4EnvironmentOutput({ environments: [], relationshipAttributes: [] })).not.toThrow()
    expect(() => parseS5VisualDescriptorOutput({ visualDescriptor: 'frontal portrait, neutral expression' })).not.toThrow()
    expect(() =>
      parseS5VisualDescriptorOutput({ 'visual.descriptor': 'frontal portrait, neutral expression (alt key)' }),
    ).not.toThrow()
  })

  it('builds S2 dynamic context from era canon attrs', () => {
    const entity = { id: 'ent_1', name: 'Ruslan', type: 'character' }
    const canonAttributes = [{ key: 'era.decade', value: '1990s' }]
    const eraAttrs = canonAttributes
      .filter(
        (item) =>
          /^(era|setting|culture|period|location)\./.test(item.key) ||
          ['era', 'setting', 'culture', 'period', 'location'].includes(item.key),
      )
      .map((item) => `${item.key}: ${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}`)
    const tail = [
      `Entity: ${entity?.name || entity?.id} (${entity?.type || 'character'})`,
      eraAttrs.length ? `Canon era/setting:\n${eraAttrs.join('\n')}` : 'Canon era/setting: (none supplied)',
    ]
      .filter(Boolean)
      .join('\n')
    expect(tail).toContain('Ruslan')
    expect(tail).toContain('era.decade')
  })

  it('writes low-confidence inferred attrs from S2 parser', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'ent_s2', type: 'character', name: 'Ruslan' })
    const { accepted: writes } = applyS2Parser(db, 'ent_s2', {
      attributes: [{ key: 'wardrobe.jacket', value: 'worn student jacket', confidence: 0.9 }],
    })
    expect(writes).toHaveLength(1)
    expect(writes[0].confidence).toBeLessThanOrEqual(0.6)
    expect(writes[0].provenance).toBe('inferred')
  })

  it('creates environment entities from S4 parser', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'ent_s4', type: 'character', name: 'Ruslan' })
    const { accepted: writes, suggestions } = applyS4Parser(db, 'ent_s4', {
      environments: [{ name: 'Beer hall', summary: 'Friday hangout' }],
      attributes: [{ key: 'routine.friday', value: 'spends Fridays at beer hall with friends' }],
      relationshipAttributes: [{
        type: 'romantic.crush',
        otherSlug: 'rita_vlasova',
        value: 'in love with Rita Vlasova',
      }],
    })
    expect(suggestions).toHaveLength(1)
    expect(writes.some((item) => item.key === 'routine.friday')).toBe(true)
    expect(writes.some((item) => item.key === 'relation.romantic.crush:rita_vlasova' && item.provenance === 'derived')).toBe(true)
    expect(getPrompt('extrapolation.s4.environment', '1').body).toContain('environments')
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
      if (user.includes('Write a single visual descriptor')) {
        return JSON.stringify({ visualDescriptor: 'frontal portrait, neutral expression' })
      }
      if (user.includes('Infer psychology attributes')) {
        return JSON.stringify({ attributes: [{ key: 'behavior.temperament', value: 'wry', confidence: 0.7 }] })
      }
      if (user.includes('You enrich a fictional character with period-specific')) {
        return JSON.stringify({ attributes: [{ key: 'culture.slang', value: 'bro', confidence: 0.5 }] })
      }
      if (user.includes('Project likely environments and relationship-derived')) {
        return JSON.stringify({
          environments: [{ name: 'Communal apartment', summary: 'Shared kitchen' }],
          attributes: [{ key: 'home.context', value: 'lives in communal apartment' }],
        })
      }
      if (user.includes('Detect contradictions')) {
        return JSON.stringify({ conflicts: [] })
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
    for (const st of result.stages) {
      expect(Array.isArray(st.dropped)).toBe(true)
    }
  })

  it('invalidates stage cache after dismissing writes so S5 can rewrite visual.descriptor', async () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'ent_s5_cache', type: 'character', name: 'Ruslan' })
    writeAttribute(db, {
      entityId: 'ent_s5_cache',
      key: 'description',
      value: 'A student in 1990s Moscow.',
      provenance: 'canon',
      confidence: 1,
      sourceStage: 1,
    })

    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-extrapolation-cache-'))
    tempDirs.push(cacheDir)
    const cache = new StageCache({ cacheDir })
    const llm = async () => JSON.stringify({ visualDescriptor: 'frontal portrait, neutral expression' })

    const first = await runExtrapolationStage({
      db,
      entityId: 'ent_s5_cache',
      stageId: 5,
      llm,
      cache,
    })
    expect(first.cacheHit).toBe(false)
    expect(first.writes).toHaveLength(1)
    const writtenId = first.writes[0].id
    expect(listAttributes(db, { entityId: 'ent_s5_cache', key: 'visual.descriptor' })).toHaveLength(1)

    dismissSuggested(db, writtenId)
    expect(listAttributes(db, { entityId: 'ent_s5_cache', key: 'visual.descriptor' })).toHaveLength(0)

    let llmCalls = 0
    const third = await runExtrapolationStage({
      db,
      entityId: 'ent_s5_cache',
      stageId: 5,
      llm: async () => {
        llmCalls += 1
        return JSON.stringify({ visualDescriptor: 'frontal portrait, neutral expression' })
      },
      cache,
    })
    expect(third.cacheHit).toBe(false)
    expect(llmCalls).toBe(1)
    expect(third.writes).toHaveLength(1)
    expect(third.writes[0].id).not.toBe(writtenId)
    const active = listAttributes(db, { entityId: 'ent_s5_cache', key: 'visual.descriptor' })
    expect(active).toHaveLength(1)
    expect(active[0].value).toBe('frontal portrait, neutral expression')
  })

  it('runs stages 2-5 in parallel when enabled', async () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'ent_parallel', type: 'character', name: 'Ruslan' })
    writeAttribute(db, {
      entityId: 'ent_parallel',
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
      if (user.includes('Write a single visual descriptor')) {
        return JSON.stringify({ visualDescriptor: 'frontal portrait, neutral expression' })
      }
      if (user.includes('Infer psychology attributes')) {
        return JSON.stringify({ attributes: [{ key: 'behavior.temperament', value: 'wry', confidence: 0.7 }] })
      }
      if (user.includes('You enrich a fictional character with period-specific')) {
        return JSON.stringify({ attributes: [{ key: 'culture.slang', value: 'bro', confidence: 0.5 }] })
      }
      if (user.includes('Project likely environments and relationship-derived')) {
        return JSON.stringify({
          environments: [{ name: 'Communal apartment', summary: 'Shared kitchen' }],
          attributes: [{ key: 'home.context', value: 'lives in communal apartment' }],
        })
      }
      if (user.includes('Detect contradictions')) {
        return JSON.stringify({ conflicts: [] })
      }
      return '{}'
    }

    const result = await runExtrapolationPipeline({
      db,
      entityId: 'ent_parallel',
      llm,
      cache,
      parallelMiddleStages: true,
    })
    expect(result.cancelled).toBe(false)
    expect(result.stages.map((item) => item.stageId)).toEqual([1, 2, 3, 4, 5, 6])
    expect(result.prior[6]).toBeTruthy()
    for (const st of result.stages) {
      expect(Array.isArray(st.dropped)).toBe(true)
    }
  })
})
