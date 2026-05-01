import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createBankEntry,
  listActorAuditions,
  listActorCandidates,
} from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { runAudition } from './auditionOrchestrator.js'

const tempDirs = []
let db = null

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-audition-orch-test-'))
  tempDirs.push(dir)
  const dbPath = path.join(dir, 'test.sqlite')
  const instance = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(instance)
  return instance
}

function seedBankEntry(database, overrides = {}) {
  return createBankEntry(database, {
    id: 'bank_001',
    slug: 'lead_detective',
    name: 'Lead Detective',
    description: 'A composed detective with tired eyes and guarded confidence.',
    optimizedDescription: 'Composed detective, tired eyes, guarded confidence.',
    createdAt: '2026-04-28T12:00:00.000Z',
    updatedAt: '2026-04-28T12:00:00.000Z',
    ...overrides,
  })
}

function validProfileFixture(overrides = {}) {
  return {
    age: 32,
    apparentAgeRange: { min: 30, max: 35 },
    faceShape: 'oval with defined cheek contour',
    eyes: 'deep-set gray-green eyes with slight fatigue',
    eyebrows: 'straight medium-thick brows',
    nose: 'straight bridge, narrow tip',
    lips: 'medium lips with subtle asymmetry',
    jawline: 'firm angular jawline',
    skinTone: 'light olive',
    hairColor: 'dark brown',
    hairLength: 'short',
    hairTexture: 'wavy',
    hairstyle: 'side-parted textured crop',
    bodyType: 'lean athletic',
    heightImpression: 'medium-tall',
    posture: 'upright, deliberate posture',
    wardrobeBase: 'charcoal coat over muted shirt',
    cinematicArchetype: 'methodical investigator',
    personalityEnergy: 'contained intensity',
    distinctiveFeatures: ['faint scar near brow'],
    visualKeywords: ['grounded', 'realistic'],
    ...overrides,
  }
}

beforeEach(() => {
  db = createTempDb()
})

afterEach(() => {
  db?.close()
  db = null
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('runAudition', () => {
  it('happy path: count=2 produces 2 pairs, each with front+side views', async () => {
    const bank = seedBankEntry(db)
    const llmGenerate = vi.fn().mockResolvedValue(JSON.stringify([
      validProfileFixture(),
      validProfileFixture({
        age: 36,
        apparentAgeRange: { min: 34, max: 39 },
        hairstyle: 'slicked-back with loose strands',
      }),
    ]))
    const comfyService = {
      queuePromptPackById: vi.fn().mockResolvedValue({ promptId: 'prompt_001' }),
    }

    const result = await runAudition({
      db,
      bankEntryId: bank.id,
      count: 2,
      llmGenerate,
      comfyService,
    })

    expect(result.successful).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.results).toHaveLength(2)
    // Each pair has 2 views → 4 candidates and 4 auditions total.
    expect(listActorCandidates(db)).toHaveLength(4)
    const auditions = listActorAuditions(db)
    expect(auditions).toHaveLength(4)
    expect(auditions.every((item) => item.status === 'pending')).toBe(true)
    // Verify pair shape.
    const pair = result.results[0]
    expect(pair.ok).toBe(true)
    expect(pair.pairId).toBeTruthy()
    expect(pair.characterId).toBeTruthy()
    expect(Array.isArray(pair.views)).toBe(true)
    expect(pair.views).toHaveLength(2)
    expect(pair.views.map((v) => v.view)).toEqual(['front_portrait', 'profile_portrait'])
  })

  it('throws when LLM returns invalid JSON', async () => {
    const bank = seedBankEntry(db)
    const llmGenerate = vi.fn().mockResolvedValue('not-json')

    await expect(runAudition({
      db,
      bankEntryId: bank.id,
      llmGenerate,
    })).rejects.toThrow()
  })

  it('throws EMPTY_LLM_RESPONSE when LLM returns empty array', async () => {
    const bank = seedBankEntry(db)
    const llmGenerate = vi.fn().mockResolvedValue('[]')

    await expect(runAudition({
      db,
      bankEntryId: bank.id,
      llmGenerate,
    })).rejects.toMatchObject({ code: 'EMPTY_LLM_RESPONSE' })
  })

  it('throws BANK_ENTRY_NOT_FOUND when bank entry is missing', async () => {
    const llmGenerate = vi.fn().mockResolvedValue(JSON.stringify([validProfileFixture()]))
    await expect(runAudition({
      db,
      bankEntryId: 'missing_bank',
      llmGenerate,
    })).rejects.toMatchObject({ code: 'BANK_ENTRY_NOT_FOUND' })
  })

  it('marks one result failed when one profile is invalid and another is valid', async () => {
    const bank = seedBankEntry(db)
    const llmGenerate = vi.fn().mockResolvedValue(JSON.stringify([
      validProfileFixture(),
      validProfileFixture({ faceShape: undefined }),
    ]))

    const result = await runAudition({
      db,
      bankEntryId: bank.id,
      count: 2,
      llmGenerate,
    })

    expect(result.successful).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.results.some((item) => item.ok === false)).toBe(true)
    // 1 valid character × 2 views = 2 candidates and 2 auditions.
    expect(listActorCandidates(db)).toHaveLength(2)
    expect(listActorAuditions(db)).toHaveLength(2)
  })

  it('persists candidates and auditions without comfyService and returns null comfyPromptId', async () => {
    const bank = seedBankEntry(db)
    const llmGenerate = vi.fn().mockResolvedValue(JSON.stringify([
      validProfileFixture(),
    ]))

    const result = await runAudition({
      db,
      bankEntryId: bank.id,
      llmGenerate,
    })

    expect(result.successful).toBe(1)
    // comfyPromptId now lives per-view inside result.views[].
    expect(result.results[0].views[0].comfyPromptId).toBeNull()
    expect(result.results[0].views[1].comfyPromptId).toBeNull()
    // 1 character × 2 views = 2 candidates and 2 auditions.
    expect(listActorCandidates(db)).toHaveLength(2)
    expect(listActorAuditions(db)).toHaveLength(2)
  })
})
