import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComfyService } from './lib/comfy/comfyService.js'
import { buildContinuityQaScoringSheet } from './lib/continuity/continuityQaHarness.js'
import {
  assessMvpDoneGateReadiness,
  evaluateMvpDoneGate,
  runMvpDoneGateContinuityQa,
} from './lib/continuity/mvpDoneGate.js'
import {
  createEntity,
  getEntity,
  listAttributes,
  listEntities,
  listVisualAnchors,
  writeAttribute,
} from './lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from './lib/db/sqlite.js'
import { triggerStage5ReferenceImageGeneration } from './lib/extrapolation/stage5ReferenceGeneration.js'
import { RUSLAN_S1_FIXTURE, RUSLAN_SOURCE_TEXT } from './lib/extrapolation/fixtures/ruslanWorkedExample.js'
import { runExtrapolationPipeline } from './lib/extrapolation/orchestrator.js'
import { StageCache } from './lib/extrapolation/stageCache.js'

const ENTITY_ID = 'ruslan_levashov'
const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-ruslan-done-gate-'))
  tempDirs.push(dir)
  return path.join(dir, 'test.sqlite')
}

function ensureDb(dbPath) {
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

function createRuslanStubLlm() {
  return async ({ user }) => {
    if (user.includes('Extract entities and canon attributes')) return JSON.stringify(RUSLAN_S1_FIXTURE)
    if (user.includes('period-specific clothing')) {
      return JSON.stringify({ attributes: [{ key: 'wardrobe.jacket', value: 'worn student jacket', confidence: 0.9 }] })
    }
    if (user.includes('Infer psychology attributes')) {
      return JSON.stringify({ attributes: [{ key: 'behavior.temperament', value: 'wry and loyal', confidence: 0.7 }] })
    }
    if (user.includes('Project likely environments')) {
      return JSON.stringify({
        environments: [{ name: 'Soviet beer hall', summary: 'Friday hangout with friends' }],
        attributes: [{ key: 'routine.friday', value: 'spends Fridays at the beer hall' }],
      })
    }
    if (user.includes('Write a single visual descriptor')) {
      return JSON.stringify({ visualDescriptor: 'frontal portrait, neutral expression, plain backdrop, freckled face' })
    }
    if (user.includes('Detect contradictions')) return JSON.stringify({ conflicts: [] })
    return '{}'
  }
}

function mockComfyFetch() {
  let historyCalls = 0
  return vi.fn(async (url, init = {}) => {
    const target = String(url)
    if (target.endsWith('/prompt') && init.method === 'POST') {
      return { ok: true, json: async () => ({ prompt_id: 'prompt_ruslan_anchor', number: 1 }) }
    }
    if (target.endsWith('/queue')) {
      return { ok: true, json: async () => ({ queue_running: [], queue_pending: [] }) }
    }
    if (target.includes('/history/prompt_ruslan_anchor')) {
      historyCalls += 1
      if (historyCalls < 2) return { ok: true, json: async () => ({}) }
      return {
        ok: true,
        json: async () => ({
          prompt_ruslan_anchor: {
            status: { status_str: 'success' },
            outputs: { '9': { images: [{ filename: 'ruslan-anchor.png', subfolder: '', type: 'output' }] } },
          },
        }),
      }
    }
    if (target.includes('/view?')) {
      return { ok: true, arrayBuffer: async () => Buffer.from('png-bytes') }
    }
    return { ok: true, json: async () => ({}) }
  })
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
  vi.restoreAllMocks()
})

describe('Ruslan MVP Done gate (Section 4)', () => {
  it('passes readiness, five-scene continuity QA, and reviewer acceptance', async () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: ENTITY_ID, type: 'character', name: 'Ruslan Levashov' })
    writeAttribute(db, {
      entityId: ENTITY_ID,
      key: 'description',
      value: RUSLAN_SOURCE_TEXT,
      provenance: 'canon',
      confidence: 1,
      sourceStage: 0,
    })

    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-ruslan-done-gate-cache-'))
    tempDirs.push(cacheDir)
    await runExtrapolationPipeline({
      db,
      entityId: ENTITY_ID,
      llm: createRuslanStubLlm(),
      cache: new StageCache({ cacheDir }),
    })

    expect(getEntity(db, 'rita_vlasova')?.name).toBe('Rita Vlasova')
    expect(listEntities(db, { type: 'environment' }).length).toBeGreaterThanOrEqual(1)

    const fetchImpl = mockComfyFetch()
    vi.stubGlobal('fetch', fetchImpl)
    const comfyService = createComfyService({
      fetchImpl,
      env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188', COMFYUI_TIMEOUT_MS: '5000' },
    })
    await triggerStage5ReferenceImageGeneration({
      db,
      entityId: ENTITY_ID,
      comfyService,
      input: { pollIntervalMs: 1, timeoutMs: 5000 },
      sleep: () => Promise.resolve(),
    })
    expect(listVisualAnchors(db, { entityId: ENTITY_ID, type: 'reference_image' }).some((anchor) => anchor.isPrimary)).toBe(true)
    expect(listAttributes(db, { entityId: ENTITY_ID, provenance: 'canon' }).length).toBeGreaterThanOrEqual(12)

    const readiness = assessMvpDoneGateReadiness(db, ENTITY_ID)
    expect(readiness.ready).toBe(true)

    const qa = await runMvpDoneGateContinuityQa({
      db,
      entityId: ENTITY_ID,
      comfyService,
      input: { queue: { dryRun: true } },
    })
    expect(qa.sceneCount).toBe(5)
    expect(qa.outputs).toHaveLength(5)

    const scoringSheet = buildContinuityQaScoringSheet({ subject: 'Ruslan Levashov' })
    scoringSheet.scenes = scoringSheet.scenes.map((scene) => ({
      ...scene,
      scores: { face: 4, body: 4, wardrobe: 4 },
      seedHidden: true,
    }))
    const decision = evaluateMvpDoneGate(scoringSheet)
    expect(decision.accepted).toBe(true)
    expect(decision.outcome).toBe('accepted')
  })
})
