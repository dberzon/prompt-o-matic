import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCharacter, createPromptPack } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { validCharacterProfile, validQwenImagePromptPack } from '../characters/fixtures.js'
import { generateCharacterPortfolioPlan, queueCharacterPortfolio } from './characterPortfolio.js'

const tempDirs = []
const openDbs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-portfolio-test-'))
  tempDirs.push(dir)
  const dbPath = path.join(dir, 'test.sqlite')
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

describe('character portfolio service', () => {
  it('creates plan items for requested views', () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_portfolio_1' })
    const result = generateCharacterPortfolioPlan({
      db,
      characterId: 'char_portfolio_1',
      views: ['front_portrait', 'full_body'],
      workflowId: 'qwen-image-2512-default',
      options: { persistPromptPacks: true, aspectRatio: '2:3' },
    })
    expect(result.ok).toBe(true)
    expect(result.items.length).toBe(2)
    expect(result.items.every((x) => Boolean(x.promptPackId))).toBe(true)
  })

  it('reuses existing prompt pack when view/workflow/aspect matches', () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_portfolio_2' })
    const existing = createPromptPack(db, {
      ...validQwenImagePromptPack,
      id: 'pack_portfolio_reuse_1',
      characterId: 'char_portfolio_2',
      aspectRatio: '2:3',
      comfyWorkflowId: 'qwen-image-2512-default',
      consistencyTags: ['char_portfolio_2', 'front_portrait'],
    })
    const result = generateCharacterPortfolioPlan({
      db,
      characterId: 'char_portfolio_2',
      views: ['front_portrait'],
      workflowId: 'qwen-image-2512-default',
      options: { persistPromptPacks: true, aspectRatio: '2:3' },
    })
    expect(result.items[0].source).toBe('reused')
    expect(result.items[0].promptPackId).toBe(existing.id)
  })

  it('queues all requested views and returns partial results', async () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_portfolio_3' })
    const comfyService = {
      queuePromptPackById: vi.fn(async ({ promptPackId }) => {
        if (String(promptPackId).includes('failme')) throw new Error('queue failed')
        return { promptId: `p_${promptPackId}` }
      }),
    }
    const first = createPromptPack(db, {
      ...validQwenImagePromptPack,
      id: 'pack_failme',
      characterId: 'char_portfolio_3',
      aspectRatio: '2:3',
      comfyWorkflowId: 'qwen-image-2512-default',
      consistencyTags: ['char_portfolio_3', 'front_portrait'],
    })
    const second = createPromptPack(db, {
      ...validQwenImagePromptPack,
      id: 'pack_ok',
      characterId: 'char_portfolio_3',
      aspectRatio: '2:3',
      comfyWorkflowId: 'qwen-image-2512-default',
      consistencyTags: ['char_portfolio_3', 'full_body'],
    })
    const result = await queueCharacterPortfolio({
      db,
      comfyService,
      characterId: 'char_portfolio_3',
      views: ['front_portrait', 'full_body'],
      workflowId: 'qwen-image-2512-default',
      options: { persistPromptPacks: true, aspectRatio: '2:3' },
    })
    expect(result.summary.total).toBe(2)
    expect(result.summary.failed).toBe(1)
    expect(result.summary.success).toBe(1)
    expect(result.queued.find((x) => x.promptPackId === first.id).ok).toBe(false)
    expect(result.queued.find((x) => x.promptPackId === second.id).ok).toBe(true)
  })
})

