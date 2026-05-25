import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import polishHandler from '../polish.js'
import { createEntity, writeAttribute } from './db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from './db/sqlite.js'
import {
  buildPolishSystemMessage,
  getPolishV1RenderedBody,
  healthCheck,
  parsePolishRequest,
  runPolish,
} from './polishCore.js'

const POLISH_V1_FILE_SHA256 = '09f325259867e57108a1d2702480f2163732c0b35d3c8d453ce4961991d55531'
const POLISH_V1_RENDERED_SHA256 = '7d6a7e89f59c35b0416c0677b039e444051954d6b2fa6d5c8a3495828a780f86'

const tempDirs = []
const openDbs = []

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex')
}

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-polish-core-'))
  tempDirs.push(dir)
  return path.join(dir, 'test.sqlite')
}

function ensureDb(dbPath) {
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

function mockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(obj) {
      this.payload = obj
      return this
    },
    writeHead() {},
    end() {},
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
  delete process.env.SQLITE_DB_PATH
  delete process.env.APP_MODE
})

describe('polish system message bible context', () => {
  it('keeps polish.system.v1.prompt.md file anchor SHA-256 unchanged', () => {
    const abs = path.join(
      process.cwd(),
      'api/lib/prompts/library/polish.system.v1.prompt.md',
    )
    const fileBytes = fs.readFileSync(abs)
    expect(sha256Hex(fileBytes.toString('utf8'))).toBe(POLISH_V1_FILE_SHA256)
  })

  it('rendered v1 system message without entityId matches rendered-body SHA-256 snapshot', () => {
    const rendered = buildPolishSystemMessage()
    expect(sha256Hex(rendered)).toBe(POLISH_V1_RENDERED_SHA256)
    expect(Buffer.from(rendered)).toEqual(Buffer.from(getPolishV1RenderedBody()))
  })

  it('unresolvable entityId yields byte-equal baseline system message', () => {
    const dbPath = createTempDbPath()
    const db = ensureDb(dbPath)
    const baseline = buildPolishSystemMessage()
    const missingId = '550e8400-e29b-41d4-a716-446655440099'
    const withMissing = buildPolishSystemMessage({ db, entityId: missingId })
    expect(Buffer.from(withMissing)).toEqual(Buffer.from(baseline))
    expect(sha256Hex(withMissing)).toBe(POLISH_V1_RENDERED_SHA256)
  })

  it('all-null projected attributes omit bible block entirely', () => {
    const dbPath = createTempDbPath()
    const db = ensureDb(dbPath)
    const entityId = '550e8400-e29b-41d4-a716-446655440002'
    createEntity(db, { id: entityId, type: 'character', name: 'Empty' })
    const baseline = buildPolishSystemMessage()
    const message = buildPolishSystemMessage({ db, entityId })
    expect(message).toBe(baseline)
    expect(message).not.toContain('### Character Bible Reference')
  })

  it('injects bible context from seeded entity_attributes via projection paths', async () => {
    const dbPath = createTempDbPath()
    const db = ensureDb(dbPath)
    const entityId = '550e8400-e29b-41d4-a716-446655440001'
    createEntity(db, { id: entityId, type: 'character', name: 'Polish Inject' })
    writeAttribute(db, {
      entityId,
      key: 'demographics.gender',
      value: 'injected-gender-marker',
      provenance: 'canon',
    })

    const message = buildPolishSystemMessage({ db, entityId })
    expect(message).toContain('### Character Bible Reference')
    expect(message).toContain('- demographics.gender: injected-gender-marker')
    expect(sha256Hex(message)).not.toBe(POLISH_V1_RENDERED_SHA256)
  })
})

/** Payload shape sent by usePolish (explicit nulls for absent optional fields). */
const usePolishStylePayload = {
  fragments: ['cinematic medium shot', 'warm amber tone'],
  directorName: null,
  directorNote: null,
  scene: 'a quiet street at dusk',
  scenario: null,
  frontPrefix: '',
  narrativeBeat: null,
  engine: 'auto',
  localOnly: false,
  embeddedPort: null,
  embeddedSecret: null,
  embeddedModel: null,
  localProvider: null,
  lmStudioBaseUrl: null,
  lmStudioModel: null,
  cloudProvider: null,
}

describe('parsePolishRequest', () => {
  it('accepts usePolish-style payload with null optional fields', () => {
    const parsed = parsePolishRequest(usePolishStylePayload)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.data.fragments).toEqual(usePolishStylePayload.fragments)
    expect(parsed.data.directorName).toBeNull()
    expect(parsed.data.scenario).toBeNull()
  })

  it('rejects blank entityId', () => {
    const parsed = parsePolishRequest({
      fragments: ['a'],
      entityId: '   ',
    })
    expect(parsed.ok).toBe(false)
  })

  it('rejects entityId longer than 128 characters', () => {
    const parsed = parsePolishRequest({
      fragments: ['a'],
      entityId: `ent_${'x'.repeat(130)}`,
    })
    expect(parsed.ok).toBe(false)
  })
})

describe('polish route schema', () => {
  it('injects bible context for slug-style entityId through POST /api/polish', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    process.env.LLM_PROVIDER = 'ollama'
    const db = ensureDb(dbPath)
    const entityId = 'ruslan_levashov'
    createEntity(db, { id: entityId, type: 'character', name: 'Ruslan Levashov' })
    writeAttribute(db, {
      entityId,
      key: 'demographics.gender',
      value: 'slug-id-injection-marker',
      provenance: 'canon',
    })
    let capturedSystem = ''
    const fetchImpl = vi.fn(async (url, init) => {
      const s = String(url)
      if (s.includes('/api/tags')) {
        return { ok: true, json: async () => ({ models: [] }) }
      }
      if (s.includes('/api/generate')) {
        const body = JSON.parse(String(init?.body || '{}'))
        capturedSystem = body.system || ''
        return { ok: true, json: async () => ({ response: 'polished via route' }) }
      }
      return { ok: false, text: async () => 'unexpected' }
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchImpl
    try {
      const res = mockRes()
      await polishHandler(
        {
          method: 'POST',
          body: {
            fragments: ['interior', 'night'],
            entityId,
            engine: 'local',
          },
        },
        res,
      )
      expect(res.statusCode).toBe(200)
      expect(res.payload?.polished).toContain('polished via route')
      expect(capturedSystem).toContain('### Character Bible Reference')
      expect(capturedSystem).toContain('- demographics.gender: slug-id-injection-marker')
    } finally {
      globalThis.fetch = originalFetch
      delete process.env.LLM_PROVIDER
    }
  })

  it('returns 400 when entityId exceeds max length', async () => {
    const res = mockRes()
    await polishHandler(
      {
        method: 'POST',
        body: { fragments: ['test'], entityId: `ent_${'x'.repeat(130)}` },
      },
      res,
    )
    expect(res.statusCode).toBe(400)
    expect(res.payload?.error).toMatch(/Invalid polish request/i)
  })

  it('returns 200 for usePolish-style body with null optionals', async () => {
    process.env.LLM_PROVIDER = 'mock'
    const fetchImpl = vi.fn(async (url) => {
      const s = String(url)
      if (s.includes('/api/tags')) {
        return { ok: true, json: async () => ({ models: [] }) }
      }
      return { ok: false, text: async () => 'unexpected' }
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchImpl
    try {
      const res = mockRes()
      await polishHandler(
        {
          method: 'POST',
          body: {
            ...usePolishStylePayload,
            engine: 'local',
            mockResponse: 'polished via nullish contract',
          },
        },
        res,
      )
      expect(res.statusCode).toBe(200)
      expect(res.payload?.polished).toContain('polished via nullish contract')
    } finally {
      globalThis.fetch = originalFetch
      delete process.env.LLM_PROVIDER
    }
  })
})

describe('runPolish', () => {
  it('uses cloud provider when requested', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('/api/tags')) {
        return { ok: false, json: async () => ({}) }
      }
      return {
        ok: true,
        json: async () => ({ content: [{ text: 'polished cloud prompt' }] }),
      }
    })

    const result = await runPolish({
      payload: {
        engine: 'cloud',
        fragments: ['a person', 'interior'],
      },
      fetchImpl,
      env: {
        ANTHROPIC_API_KEY: 'test-key',
        LLM_PROVIDER: 'ollama',
      },
    })

    expect(result.provider).toBe('cloud')
    expect(result.polished).toContain('polished cloud prompt')
  })

  it('falls back to cloud in auto mode when local unavailable', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('/api/tags')) {
        throw new Error('offline')
      }
      return {
        ok: true,
        json: async () => ({ content: [{ text: 'cloud fallback' }] }),
      }
    })

    const result = await runPolish({
      payload: {
        engine: 'auto',
        fragments: ['wide shot', 'fog'],
      },
      fetchImpl,
      env: {
        ANTHROPIC_API_KEY: 'test-key',
        LLM_PROVIDER: 'ollama',
      },
    })

    expect(result.provider).toBe('cloud')
    expect(result.fallback).toBe('local-unavailable')
  })

  it('rejects when local-only mode is enabled and local is unavailable', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('/api/tags')) {
        throw new Error('offline')
      }
      return {
        ok: true,
        json: async () => ({ content: [{ text: 'should not reach cloud' }] }),
      }
    })

    await expect(runPolish({
      payload: {
        engine: 'auto',
        localOnly: true,
        fragments: ['rainy street'],
      },
      fetchImpl,
      env: {
        ANTHROPIC_API_KEY: 'test-key',
        LLM_PROVIDER: 'ollama',
      },
    })).rejects.toThrow('Local provider requested but Ollama is unavailable')
  })

  it('uses embedded provider when explicitly selected', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const s = String(url)
      if (s.includes('/health')) {
        return { ok: true, json: async () => ({}) }
      }
      if (s.includes('/v1/chat/completions')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'embedded polished output' } }],
          }),
        }
      }
      return { ok: false, text: async () => 'unexpected' }
    })

    const result = await runPolish({
      payload: {
        engine: 'embedded',
        fragments: ['city', 'night'],
        embeddedPort: 43211,
        embeddedSecret: 'secret',
      },
      fetchImpl,
      env: {},
    })

    expect(result.provider).toBe('embedded')
    expect(result.polished).toContain('embedded polished output')
  })

  it('uses LM Studio when local provider is configured to lmstudio', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const s = String(url)
      if (s.includes('/models')) {
        return { ok: true, json: async () => ({ data: [{ id: 'qwen-local' }] }) }
      }
      if (s.includes('/chat/completions')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'lmstudio polished output' } }],
          }),
        }
      }
      return { ok: false, text: async () => 'unexpected' }
    })

    const result = await runPolish({
      payload: {
        engine: 'local',
        fragments: ['city', 'night'],
      },
      fetchImpl,
      env: {
        LLM_PROVIDER: 'lmstudio',
      },
    })

    expect(result.provider).toBe('local')
    expect(result.polished).toContain('lmstudio polished output')
  })

  it('passes bible-appended system prompt to provider when entityId is set', async () => {
    const dbPath = createTempDbPath()
    const db = ensureDb(dbPath)
    const entityId = '550e8400-e29b-41d4-a716-446655440003'
    createEntity(db, { id: entityId, type: 'character', name: 'RunPolish' })
    writeAttribute(db, {
      entityId,
      key: 'physical.face',
      value: 'angular cheekbones marker',
      provenance: 'canon',
    })

    let capturedSystem = ''
    const fetchImpl = vi.fn(async (url, init) => {
      const s = String(url)
      if (s.includes('/api/tags')) {
        return { ok: true, json: async () => ({ models: [] }) }
      }
      if (s.includes('/api/generate')) {
        const body = JSON.parse(String(init?.body || '{}'))
        capturedSystem = body.system || ''
        return { ok: true, json: async () => ({ response: 'polished with bible' }) }
      }
      return { ok: false, text: async () => 'unexpected' }
    })

    const result = await runPolish({
      payload: {
        engine: 'local',
        fragments: ['city', 'night'],
        entityId,
      },
      fetchImpl,
      env: { LLM_PROVIDER: 'ollama' },
      db,
    })

    expect(result.polished).toContain('polished with bible')
    expect(capturedSystem).toContain('### Character Bible Reference')
    expect(capturedSystem).toContain('- physical.face: angular cheekbones marker')
  })

  it('does not append bible block when entityId is omitted', async () => {
    let capturedSystem = ''
    const fetchImpl = vi.fn(async (url, init) => {
      const s = String(url)
      if (s.includes('/api/tags')) {
        return { ok: true, json: async () => ({ models: [] }) }
      }
      if (s.includes('/api/generate')) {
        const body = JSON.parse(String(init?.body || '{}'))
        capturedSystem = body.system || ''
        return { ok: true, json: async () => ({ response: 'plain polish' }) }
      }
      return { ok: false, text: async () => 'unexpected' }
    })

    await runPolish({
      payload: {
        engine: 'local',
        fragments: ['city', 'night'],
      },
      fetchImpl,
      env: { LLM_PROVIDER: 'ollama' },
    })

    expect(capturedSystem).not.toContain('### Character Bible Reference')
    expect(sha256Hex(capturedSystem)).toBe(POLISH_V1_RENDERED_SHA256)
  })

  it('uses mock provider in local mode when configured', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const s = String(url)
      if (s.includes('/api/tags')) {
        return { ok: true, json: async () => ({ models: [] }) }
      }
      return { ok: false, text: async () => 'unexpected' }
    })

    const result = await runPolish({
      payload: {
        engine: 'local',
        fragments: ['city', 'night'],
        mockResponse: 'mocked local output',
      },
      fetchImpl,
      env: {
        LLM_PROVIDER: 'mock',
      },
    })

    expect(result.provider).toBe('local')
    expect(result.polished).toContain('mocked local output')
  })
})

describe('healthCheck', () => {
  it('reports Ollama and LM Studio as available when both probes succeed', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const s = String(url)
      if (s.includes('/api/tags')) {
        return {
          ok: true,
          json: async () => ({
            models: [{ name: 'qwen2.5:7b-instruct' }],
          }),
        }
      }
      if (s.includes('/models')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 'qwen-local' }] }),
        }
      }
      return { ok: false, json: async () => ({}) }
    })

    const result = await healthCheck({
      engine: 'local',
      fetchImpl,
      env: {
        OLLAMA_MODEL: 'qwen2.5:7b-instruct',
        LMSTUDIO_BASE_URL: 'http://127.0.0.1:1234/v1',
      },
    })

    expect(result.local.available).toBe(true)
    expect(result.local.installed).toBe(true)
    expect(result.lmstudio.available).toBe(true)
    expect(result.provider).toBe('local')
  })

  it('reports Ollama unavailable when tags probe fails', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const s = String(url)
      if (s.includes('/api/tags')) {
        throw new Error('offline')
      }
      if (s.includes('/models')) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        }
      }
      return { ok: false, json: async () => ({}) }
    })

    const result = await healthCheck({
      engine: 'cloud',
      fetchImpl,
      env: {
        OLLAMA_MODEL: 'qwen2.5:7b-instruct',
      },
    })

    expect(result.local.available).toBe(false)
  })

  it('reports LM Studio unavailable when models probe fails', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const s = String(url)
      if (s.includes('/api/tags')) {
        return {
          ok: true,
          json: async () => ({
            models: [{ name: 'qwen2.5:7b-instruct' }],
          }),
        }
      }
      if (s.includes('/models')) {
        throw new Error('lmstudio down')
      }
      return { ok: false, json: async () => ({}) }
    })

    const result = await healthCheck({
      engine: 'cloud',
      fetchImpl,
      env: {
        OLLAMA_MODEL: 'qwen2.5:7b-instruct',
        LMSTUDIO_BASE_URL: 'http://127.0.0.1:1234/v1',
      },
    })

    expect(result.lmstudio.available).toBe(false)
    expect(result.local.available).toBe(true)
  })
})
