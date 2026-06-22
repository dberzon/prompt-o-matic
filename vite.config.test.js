import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { apiDevPlugin } from './vite.config.js'
import { createSqliteDatabase, initializeDatabase } from './api/lib/db/sqlite.js'
import { getCharacter, listBatchCandidates } from './api/lib/db/repositories.js'
import { approveCandidate, persistBatchFromGeneration } from './api/lib/characters/batchReview.js'
import { validCharacterProfile } from './api/lib/characters/fixtures.js'

const tempDirs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-vite-api-test-'))
  tempDirs.push(dir)
  return path.join(dir, 'test.sqlite')
}

function makeEnv(dbPath) {
  return {
    APP_MODE: 'local-studio',
    AUTO_START_CHROMA: 'false',
    LLM_PROVIDER: 'mock',
    SQLITE_DB_PATH: dbPath,
  }
}

function makeGenerationResult() {
  return {
    request: { count: 1, ageMin: 20, ageMax: 28, outputViews: ['front_portrait'], candidateMultiplier: 1, diversityRequirements: [] },
    options: { persistBatch: true, saveAccepted: false, checkSimilarity: true, mutateSimilar: false, similarityLimit: 5, maxCandidates: 1 },
    provider: { engine: 'local', localProvider: 'mock' },
    summary: { generated: 1, accepted: 1, rejected: 0, needsMutation: 0, saved: 0 },
    accepted: [{ candidate: { ...validCharacterProfile, id: 'cand_ok' }, nearestMatches: [] }],
    rejected: [],
    needsMutation: [],
    errors: [],
  }
}

function installApiPlugin(env) {
  const routes = []
  const server = {
    httpServer: { once: () => {} },
    middlewares: {
      use(route, handler) {
        routes.push({ route, handler })
      },
    },
  }

  apiDevPlugin(env).configureServer(server)
  return routes
}

function createResponse() {
  return {
    statusCode: null,
    body: '',
    writeHead(statusCode) {
      this.statusCode = statusCode
    },
    end(chunk = '') {
      this.body += chunk
    },
  }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('apiDevPlugin character batch middleware', () => {
  it('saves an approved batch candidate as a character', async () => {
    const dbPath = createTempDbPath()
    const env = makeEnv(dbPath)
    const seedDb = createSqliteDatabase({ env })
    initializeDatabase(seedDb)
    const batch = persistBatchFromGeneration(seedDb, makeGenerationResult())
    const candidate = listBatchCandidates(seedDb, batch.id).find((item) => item.classification === 'accepted')
    approveCandidate(seedDb, { candidateId: candidate.id })
    seedDb.close()

    const routes = installApiPlugin(env)
    const route = routes.find((item) => item.route === '/api/character-batch-candidate-save')
    expect(route).toBeTruthy()

    const res = createResponse()
    await route.handler({ method: 'POST', body: { candidateId: candidate.id, force: true } }, res)

    expect(res.statusCode).toBe(200)
    const payload = JSON.parse(res.body)
    expect(payload.ok).toBe(true)
    expect(payload.item.savedCharacterId).toBeTruthy()

    const verifyDb = createSqliteDatabase({ env })
    initializeDatabase(verifyDb)
    expect(getCharacter(verifyDb, payload.item.savedCharacterId)).not.toBeNull()
    verifyDb.close()
  })
})
