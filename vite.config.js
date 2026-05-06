import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'
import path from 'path'
import { healthCheck, runPolish } from './api/lib/polishCore.js'
import { resolveProviderSelection, runWithResolvedProvider } from './api/lib/polishCore.js'
import { runReferenceImageAnalysis } from './api/lib/referenceImageCore.js'
import { runCharacterOptimize } from './api/lib/characterOptimizeCore.js'
import { runBatchCharacterGeneration } from './api/lib/characters/batchGeneration.js'
import {
  approveCandidate,
  getBatch,
  listBatches,
  listCandidatesForBatch,
  mutateBatchCandidate,
  persistBatchFromGeneration,
  refillCharacterBatch,
  recalculateCharacterBatchSummary,
  rejectCandidate,
  saveCandidateAsCharacter,
} from './api/lib/characters/batchReview.js'
import { assertCharacterBatchOperationAllowed } from './api/lib/characters/access.js'
import { assertPromptPackOperationAllowed } from './api/lib/prompts/access.js'
import {
  compileBatchPromptPacks,
  compileCharacterPromptPacks,
  listPromptPacksForCharacter,
} from './api/lib/prompts/qwenPromptCompiler.js'
import { generateCharacterPortfolioPlan, queueCharacterPortfolio } from './api/lib/portfolio/characterPortfolio.js'
import { assertComfyOperationAllowed } from './api/lib/comfy/access.js'
import { createComfyService } from './api/lib/comfy/comfyService.js'
import { runAudition } from './api/lib/audition/auditionOrchestrator.js'
import {
  createActorAudition,
  createActorCandidate,
  createBankEntry,
  deleteActorAudition,
  deleteActorCandidate,
  deleteBankEntry,
  getActorAudition,
  getActorCandidate,
  getBankEntry,
  getBankEntryBySlug,
  getGeneratedImageRecord,
  getPromptPack,
  listActorAuditions,
  listActorCandidates,
  listBankEntries,
  createCharacter,
  getCharacter,
  listCharacters,
  deleteCharacter,
  listGeneratedImageRecords,
  updateActorAudition,
  updateActorCandidate,
  updateBankEntry,
  updateCharacter,
  updateGeneratedImageRecord,
  archiveCharacter,
  restoreCharacter,
  reconsiderBatchCandidate,
  getBatchCandidate,
  updateBatchCandidate,
  listActiveComfyJobs,
  bulkUpsertComfyJobs,
  bulkUpdateComfyJobStatus,
  listSavedPrompts,
  createSavedPrompt,
  deleteSavedPrompt,
  renameSavedPrompt,
  listWorkspaceProfiles,
  upsertWorkspaceProfile,
  deleteWorkspaceProfile,
} from './api/lib/db/repositories.js'
import { createVectorRuntime } from './api/lib/vector/runtime.js'
import { createSqliteDatabase, initializeDatabase } from './api/lib/db/sqlite.js'
import {
  setAuditioned as lcSetAuditioned,
  setPreview as lcSetPreview,
  setPortfolioPending as lcSetPortfolioPending,
  setPortfolioFailed as lcSetPortfolioFailed,
  setReady as lcSetReady,
} from './api/lib/characterLifecycle.js'
import { assertGeneratedImagesOperationAllowed } from './api/lib/generatedImages/access.js'
import { assertVectorOperationAllowed, sanitizeVectorStatusForMode } from './api/lib/vector/access.js'
import {
  findSimilarCharactersById,
  findSimilarCharactersByText,
  getVectorStatus,
  indexCharacterById,
  parseIndexCharacterRequest,
  parseReindexRequest,
  parseSimilarByCharacterRequest,
  parseSimilarByTextRequest,
  reindexCharacters,
} from './api/lib/vector/maintenance.js'
import {
  normalizeHandlerError,
  readJsonBody,
  sendJsonMiddleware,
} from './api/lib/http.js'

// ── Chroma auto-spawn ─────────────────────────────────────────────────────────
let chromaProcess = null

async function isChromaRunning(url = 'http://127.0.0.1:8000') {
  for (const endpoint of [`${url}/api/v2/heartbeat`, `${url}/api/v1/heartbeat`]) {
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(1500) })
      if (res.ok) return true
    } catch { /* try next */ }
  }
  return false
}

async function startChromaServer(chromaDataPath = './chroma_data') {
  const already = await isChromaRunning()
  if (already) {
    console.log('\x1b[36m[chroma]\x1b[0m Already running on :8000')
    return
  }
  console.log('\x1b[36m[chroma]\x1b[0m Starting… (chroma run --path', chromaDataPath + ')')
  // Strip node_modules/.bin from PATH so the system Python `chroma` is found
  // instead of the chromadb npm package's CLI (which doesn't support Windows x64).
  const spawnEnv = { ...process.env }
  if (spawnEnv.PATH) {
    spawnEnv.PATH = spawnEnv.PATH.split(path.delimiter)
      .filter((p) => !p.includes('node_modules'))
      .join(path.delimiter)
  }
  // Avoid shell:true (triggers Node deprecation warning when args are passed).
  // On Windows, run via cmd /c; on Unix, use sh -c.
  const isWin = process.platform === 'win32'
  const [cmd, args] = isWin
    ? ['cmd', ['/c', 'chroma', 'run', '--path', chromaDataPath]]
    : ['sh', ['-c', `chroma run --path ${chromaDataPath}`]]
  chromaProcess = spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: spawnEnv,
  })
  chromaProcess.stdout.on('data', (d) => {
    for (const line of d.toString().trim().split('\n')) {
      console.log(`\x1b[36m[chroma]\x1b[0m ${line}`)
    }
  })
  chromaProcess.stderr.on('data', (d) => {
    for (const line of d.toString().trim().split('\n')) {
      if (line.trim()) console.log(`\x1b[36m[chroma]\x1b[0m ${line}`)
    }
  })
  chromaProcess.on('exit', (code) => {
    if (code !== null) console.log(`\x1b[36m[chroma]\x1b[0m Process exited (code ${code})`)
    chromaProcess = null
  })
  for (const sig of ['exit', 'SIGINT', 'SIGTERM']) {
    process.once(sig, () => { chromaProcess?.kill(); chromaProcess = null })
  }
}

// ── SSE render watcher (singleton across all requests) ────────────────────────
const sseClients = new Set()
const seenPromptIds = new Map() // promptId → timestamp (for sliding-window cleanup)
let comfyWatcherTimer = null

function broadcastSSE(data) {
  const payload = `event: render-update\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of [...sseClients]) {
    try { client.write(payload) } catch { sseClients.delete(client) }
  }
}

let watcherDb = null

function getWatcherDb(env) {
  if (watcherDb) return watcherDb
  try {
    watcherDb = createSqliteDatabase({ env })
    initializeDatabase(watcherDb)
    for (const sig of ['exit', 'SIGINT', 'SIGTERM']) {
      process.once(sig, () => { try { watcherDb?.close() } catch { /* ignore */ } })
    }
  } catch { watcherDb = null }
  return watcherDb
}

function startComfyWatcher(comfyBaseUrl, env) {
  if (comfyWatcherTimer) return
  comfyWatcherTimer = setInterval(async () => {
    if (sseClients.size === 0) return
    // Skip poll when no active jobs exist — avoids 2s ComfyUI hammering at idle.
    const db = getWatcherDb(env)
    if (db) {
      try {
        const activeCount = db.prepare(
          "SELECT COUNT(*) as n FROM comfy_jobs WHERE status NOT IN ('success','failed')"
        ).get()?.n ?? 0
        if (activeCount === 0) return
      } catch { /* DB query failed — proceed with poll */ }
    }
    try {
      const res = await fetch(`${comfyBaseUrl}/history?max_items=40`, { signal: AbortSignal.timeout(3000) })
      if (!res.ok) return
      const history = await res.json()
      const now = Date.now()
      for (const [id, ts] of seenPromptIds) { if (now - ts > 600_000) seenPromptIds.delete(id) }
      for (const [promptId, job] of Object.entries(history)) {
        if (seenPromptIds.has(promptId)) continue
        if (job.status?.completed) {
          seenPromptIds.set(promptId, now)
          const hasError = Object.values(job.status?.messages || {}).some((m) => m?.[0] === 'execution_error')
          broadcastSSE({ promptId, status: hasError ? 'failed' : 'success' })
        }
      }
    } catch { /* ComfyUI unavailable — retry next tick */ }
  }, 2000)
}

function apiDevPlugin(env) {
  return {
    name: 'api-dev-polish',
    configureServer(server) {
      const chromaUrl = env.CHROMA_URL || 'http://127.0.0.1:8000'

      const autoStartChroma = env.AUTO_START_CHROMA !== 'false'
      server.httpServer?.once('listening', () => {
        if (autoStartChroma) startChromaServer(env.CHROMA_DATA_PATH || './chroma_data')
      })

      server.middlewares.use('/api/chroma-health', async (req, res) => {
        if (req.method !== 'GET') { sendJsonMiddleware(res, 405, { error: 'Method not allowed' }); return }
        const available = await isChromaRunning(chromaUrl)
        sendJsonMiddleware(res, 200, { available, url: chromaUrl })
      })

      server.middlewares.use('/api/polish', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }

        try {
          const body = await readJsonBody(req)
          const result = await runPolish({ payload: body, env })
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          console.error('[api-dev] Error:', err?.message, err?.meta ?? '')
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message })
        }
      })

      server.middlewares.use('/api/polish-health', async (req, res) => {
        if (req.method !== 'GET') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        try {
          const url = new URL(req.url || '', 'http://localhost')
          const engine = url.searchParams.get('engine') || 'auto'
          const localOnly = url.searchParams.get('localOnly') === '1' || url.searchParams.get('localOnly') === 'true'
          const payload = {
            embeddedPort: url.searchParams.get('embeddedPort')
              ? Number(url.searchParams.get('embeddedPort'))
              : null,
            embeddedSecret: url.searchParams.get('embeddedSecret') || null,
            embeddedModel: url.searchParams.get('embeddedModel') || null,
            localProvider: url.searchParams.get('localProvider') || null,
            lmStudioBaseUrl: url.searchParams.get('lmStudioBaseUrl') || null,
            lmStudioModel: url.searchParams.get('lmStudioModel') || null,
          }
          const result = await healthCheck({ engine, localOnly, payload, env })
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message })
        }
      })

      server.middlewares.use('/api/analyze-reference-image', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        try {
          const body = await readJsonBody(req)
          const result = await runReferenceImageAnalysis({ payload: body, env })
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          console.error('[api-dev] Reference image analysis error:', err?.message, err?.meta ?? '')
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message })
        }
      })

      server.middlewares.use('/api/optimize-character', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }

        try {
          const body = await readJsonBody(req)
          const result = await runCharacterOptimize({ payload: body, env })
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          console.error('[api-dev] Character optimize error:', err?.message, err?.meta ?? '')
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message })
        }
      })

      server.middlewares.use('/api/characters-generate-batch', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }

        let runtime = null
        try {
          assertCharacterBatchOperationAllowed('generate-batch', env)
          const body = await readJsonBody(req)
          runtime = createVectorRuntime({ env })
          const llmGenerate = async ({ system, user, providerPayload }) => {
            const providerSelection = await resolveProviderSelection({
              engine: providerPayload?.engine,
              localOnly: false,
              fetchImpl: fetch,
              env,
              payload: providerPayload || {},
            })
            return runWithResolvedProvider({
              provider: providerSelection.provider,
              userMessage: user,
              payload: providerPayload || {},
              fetchImpl: fetch,
              env,
              systemPrompt: system,
            })
          }
          const result = await runBatchCharacterGeneration({
            db: runtime.db,
            vectorStore: runtime.vectorStore,
            embeddingProvider: runtime.embeddingProvider,
            llmGenerate,
            input: body,
          })
          if (result.options?.persistBatch) {
            const batch = persistBatchFromGeneration(runtime.db, result)
            sendJsonMiddleware(res, 200, {
              ok: true,
              batchId: batch.id,
              summary: result.summary,
              candidates: {
                accepted: result.accepted.length,
                rejected: result.rejected.length,
                needsMutation: result.needsMutation.length,
              },
            })
            return
          }
          sendJsonMiddleware(res, 200, { ok: true, ...result })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_BATCH_GENERATE_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/character-batches', async (req, res) => {
        if (req.method !== 'GET') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertCharacterBatchOperationAllowed('list-batches', env)
          runtime = createVectorRuntime({ env })
          const url = new URL(req.url || '', 'http://localhost')
          const status = url.searchParams.get('status') || undefined
          sendJsonMiddleware(res, 200, { ok: true, items: listBatches(runtime.db, { status }) })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_BATCH_LIST_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/characters', async (req, res) => {
        if (req.method === 'DELETE') {
          let runtime = null
          try {
            assertCharacterBatchOperationAllowed('list-characters', env)
            const url = new URL(req.url || '', 'http://localhost')
            const id = url.searchParams.get('id') || ''
            if (!id) { sendJsonMiddleware(res, 400, { error: 'Missing id' }); return }
            runtime = createVectorRuntime({ env })
            const deleted = deleteCharacter(runtime.db, id)
            if (!deleted) { sendJsonMiddleware(res, 404, { error: 'Character not found' }); return }
            sendJsonMiddleware(res, 200, { ok: true })
          } catch (err) {
            const normalized = normalizeHandlerError(err)
            sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_DELETE_ERROR' })
          } finally {
            runtime?.close?.()
          }
          return
        }
        if (req.method !== 'GET') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertCharacterBatchOperationAllowed('list-characters', env)
                    const url = new URL(req.url || '', 'http://localhost')
          const projectId = url.searchParams.get('projectId') || undefined
          const gender = url.searchParams.get('gender') || undefined
          const search = url.searchParams.get('search') || undefined
          const ageMin = url.searchParams.has('ageMin') ? Number(url.searchParams.get('ageMin')) : undefined
          const ageMax = url.searchParams.has('ageMax') ? Number(url.searchParams.get('ageMax')) : undefined
          const includeArchivedParam = url.searchParams.get('includeArchived') || ''
          const includeArchived = includeArchivedParam === 'only' ? 'only' : includeArchivedParam === 'true' ? true : false
          runtime = createVectorRuntime({ env })
          const singleId = url.searchParams.get('id') || ''
          if (singleId) {
            const character = getCharacter(runtime.db, singleId)
            if (!character) {
              sendJsonMiddleware(res, 404, { error: 'Character not found' })
              return
            }
            const images = listGeneratedImageRecords(runtime.db, { characterId: singleId }).map((img) => ({
              ...img,
              imageUrl: `/api/generated-image-view?id=${encodeURIComponent(img.id)}`,
            }))
            sendJsonMiddleware(res, 200, { ok: true, item: { ...character, images } })
            return
          }
          const items = listCharacters(runtime.db, {
            projectId,
            gender,
            search,
            ageMin: Number.isFinite(ageMin) ? ageMin : undefined,
            ageMax: Number.isFinite(ageMax) ? ageMax : undefined,
            includeArchived,
          })
          const allImages = listGeneratedImageRecords(runtime.db, {})
          const imagesByChar = {}
          for (const img of allImages) {
            const cid = img.characterId
            if (!cid) continue
            if (!imagesByChar[cid]) imagesByChar[cid] = []
            imagesByChar[cid].push(img)
          }
          const enriched = items.map((c) => {
            const imgs = imagesByChar[c.id] || []
            const thumb = imgs.find((i) => i.viewType === 'front_portrait') ?? imgs[0] ?? null
            return { ...c, thumbnailUrl: thumb ? `/api/generated-image-view?id=${encodeURIComponent(thumb.id)}` : null, imageCount: imgs.length }
          })
          sendJsonMiddleware(res, 200, { ok: true, items: enriched, total: enriched.length })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTERS_LIST_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/character-lifecycle', async (req, res) => {
        if (req.method !== 'POST') { sendJsonMiddleware(res, 405, { error: 'Method not allowed' }); return }
        const LC_VALID = ['auditioned', 'preview', 'portfolio_pending', 'portfolio_failed', 'ready']
        const LC_FNS = {
          auditioned: lcSetAuditioned,
          preview: lcSetPreview,
          portfolio_pending: lcSetPortfolioPending,
          portfolio_failed: lcSetPortfolioFailed,
          ready: lcSetReady,
        }
        let runtime = null
        try {
          const body = await readJsonBody(req)
          const characterId = body?.characterId
          const lifecycleStatus = body?.lifecycleStatus
          if (!characterId) { sendJsonMiddleware(res, 400, { error: 'Missing characterId' }); return }
          if (!LC_VALID.includes(lifecycleStatus)) { sendJsonMiddleware(res, 400, { error: `Invalid lifecycleStatus. Valid: ${LC_VALID.join(', ')}` }); return }
          runtime = createVectorRuntime({ env })
          const updated = LC_FNS[lifecycleStatus](runtime.db, characterId)
          sendJsonMiddleware(res, 200, { ok: true, item: updated })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_LIFECYCLE_ERROR' })
        } finally { runtime?.close?.() }
      })

      server.middlewares.use('/api/render-events', (req, res) => {
        if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
        const comfyBaseUrl = env.COMFY_BASE_URL || 'http://127.0.0.1:8188'
        startComfyWatcher(comfyBaseUrl, env)
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })
        res.write(': SSE connected\n\n')
        sseClients.add(res)
        const heartbeat = setInterval(() => {
          try { res.write(': heartbeat\n\n') } catch { clearInterval(heartbeat); sseClients.delete(res) }
        }, 15_000)
        req.on('close', () => { clearInterval(heartbeat); sseClients.delete(res) })
      })

      server.middlewares.use('/api/character-rename', async (req, res) => {
        if (req.method !== 'POST') { sendJsonMiddleware(res, 405, { error: 'Method not allowed' }); return }
        let runtime = null
        try {
          const body = await readJsonBody(req)
          const characterId = body?.characterId
          const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : null
          if (!characterId) { sendJsonMiddleware(res, 400, { error: 'Missing characterId' }); return }
          if (!name) { sendJsonMiddleware(res, 400, { error: 'Missing or empty name' }); return }
          runtime = createVectorRuntime({ env })
          const updated = updateCharacter(runtime.db, characterId, { name })
          if (!updated) { sendJsonMiddleware(res, 404, { error: 'Character not found' }); return }
          sendJsonMiddleware(res, 200, { ok: true, item: updated })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_RENAME_ERROR' })
        } finally { runtime?.close?.() }
      })

      server.middlewares.use('/api/character-archive', async (req, res) => {
        if (req.method !== 'POST') { sendJsonMiddleware(res, 405, { error: 'Method not allowed' }); return }
        let runtime = null
        try {
          const body = await readJsonBody(req)
          const characterId = body?.characterId
          if (!characterId) { sendJsonMiddleware(res, 400, { error: 'Missing characterId' }); return }
          runtime = createVectorRuntime({ env })
          const ok = archiveCharacter(runtime.db, characterId)
          if (!ok) { sendJsonMiddleware(res, 404, { error: 'Character not found' }); return }
          sendJsonMiddleware(res, 200, { ok: true })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_ARCHIVE_ERROR' })
        } finally { runtime?.close?.() }
      })

      server.middlewares.use('/api/character-restore', async (req, res) => {
        if (req.method !== 'POST') { sendJsonMiddleware(res, 405, { error: 'Method not allowed' }); return }
        let runtime = null
        try {
          const body = await readJsonBody(req)
          const characterId = body?.characterId
          if (!characterId) { sendJsonMiddleware(res, 400, { error: 'Missing characterId' }); return }
          runtime = createVectorRuntime({ env })
          const ok = restoreCharacter(runtime.db, characterId)
          if (!ok) { sendJsonMiddleware(res, 404, { error: 'Character not found' }); return }
          sendJsonMiddleware(res, 200, { ok: true })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_RESTORE_ERROR' })
        } finally { runtime?.close?.() }
      })

      server.middlewares.use('/api/character-batch', async (req, res) => {
        if (req.method !== 'GET') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertCharacterBatchOperationAllowed('get-batch', env)
          const url = new URL(req.url || '', 'http://localhost')
          const id = url.searchParams.get('id') || ''
          if (!id) {
            sendJsonMiddleware(res, 400, { error: 'Missing id' })
            return
          }
          runtime = createVectorRuntime({ env })
          const item = getBatch(runtime.db, id)
          if (!item) {
            sendJsonMiddleware(res, 404, { error: 'Batch not found' })
            return
          }
          sendJsonMiddleware(res, 200, { ok: true, item })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_BATCH_GET_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/character-batch-candidates', async (req, res) => {
        if (req.method !== 'GET') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertCharacterBatchOperationAllowed('list-candidates', env)
          const url = new URL(req.url || '', 'http://localhost')
          const batchId = url.searchParams.get('batchId') || ''
          if (!batchId) {
            sendJsonMiddleware(res, 400, { error: 'Missing batchId' })
            return
          }
          runtime = createVectorRuntime({ env })
          const items = listCandidatesForBatch(runtime.db, {
            batchId,
            classification: url.searchParams.get('classification') || undefined,
            reviewStatus: url.searchParams.get('reviewStatus') || undefined,
          })
          sendJsonMiddleware(res, 200, { ok: true, items })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_BATCH_CANDIDATE_LIST_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/character-batch-candidate-approve', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertCharacterBatchOperationAllowed('candidate-approve', env)
          const body = await readJsonBody(req)
          runtime = createVectorRuntime({ env })
          const item = approveCandidate(runtime.db, body || {})
          if (!item) {
            sendJsonMiddleware(res, 404, { error: 'Candidate not found' })
            return
          }
          sendJsonMiddleware(res, 200, { ok: true, item })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_BATCH_CANDIDATE_APPROVE_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/character-batch-candidate-reject', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertCharacterBatchOperationAllowed('candidate-reject', env)
          const body = await readJsonBody(req)
          runtime = createVectorRuntime({ env })
          const item = rejectCandidate(runtime.db, body || {})
          if (!item) {
            sendJsonMiddleware(res, 404, { error: 'Candidate not found' })
            return
          }
          sendJsonMiddleware(res, 200, { ok: true, item })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_BATCH_CANDIDATE_REJECT_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/character-batch-candidate-reconsider', async (req, res) => {
        if (req.method !== 'POST') { sendJsonMiddleware(res, 405, { error: 'Method not allowed' }); return }
        let runtime = null
        try {
          assertCharacterBatchOperationAllowed('candidate-reconsider', env)
          const body = await readJsonBody(req)
          const candidateId = body?.candidateId
          if (!candidateId) { sendJsonMiddleware(res, 400, { error: 'Missing candidateId' }); return }
          runtime = createVectorRuntime({ env })
          const item = reconsiderBatchCandidate(runtime.db, candidateId)
          if (!item) { sendJsonMiddleware(res, 404, { error: 'Candidate not found' }); return }
          sendJsonMiddleware(res, 200, { ok: true, item })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_BATCH_CANDIDATE_RECONSIDER_ERROR' })
        } finally { runtime?.close?.() }
      })

      server.middlewares.use('/api/character-batch-candidate-save', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertCharacterBatchOperationAllowed('candidate-save', env)
          const body = await readJsonBody(req)
          runtime = createVectorRuntime({ env })
          const item = saveCandidateAsCharacter(runtime.db, body || {})
          if (!item) {
            sendJsonMiddleware(res, 404, { error: 'Candidate not found' })
            return
          }
          sendJsonMiddleware(res, 200, { ok: true, item })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_BATCH_CANDIDATE_SAVE_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/batch-candidate-preview', async (req, res) => {
        if (req.method !== 'POST') { sendJsonMiddleware(res, 405, { error: 'Method not allowed' }); return }
        let runtime = null
        try {
          assertCharacterBatchOperationAllowed('candidate-preview', env)
          const body = await readJsonBody(req)
          const { candidateId, workflowId } = body || {}
          if (!candidateId) { sendJsonMiddleware(res, 400, { error: 'Missing candidateId' }); return }
          runtime = createVectorRuntime({ env })
          const candidate = getBatchCandidate(runtime.db, candidateId)
          if (!candidate) { sendJsonMiddleware(res, 404, { error: 'Candidate not found' }); return }
          if (candidate.reviewStatus !== 'approved') {
            sendJsonMiddleware(res, 400, { error: 'Candidate must be approved before previewing' }); return
          }
          const tempChar = createCharacter(runtime.db, {
            ...candidate.candidate,
            embeddingStatus: 'not_indexed',
            lifecycleStatus: 'preview',
          })
          const compileResult = compileCharacterPromptPacks({
            db: runtime.db,
            input: { characterId: tempChar.id, views: ['front_portrait'] },
          })
          const promptPack = compileResult?.packs?.[0] ?? null
          if (!promptPack) {
            deleteCharacter(runtime.db, tempChar.id)
            sendJsonMiddleware(res, 500, { error: 'Failed to compile prompt pack for preview' }); return
          }
          const service = createComfyService({ env })
          const comfyJob = await service.queuePromptPackById({
            db: runtime.db, promptPackId: promptPack.id,
            workflowId: workflowId || undefined, allowWorkflowFallback: true, front: true,
          })
          if (comfyJob?.error) {
            deleteCharacter(runtime.db, tempChar.id)
            sendJsonMiddleware(res, 502, { error: comfyJob.error }); return
          }
          sendJsonMiddleware(res, 200, {
            ok: true, candidateId,
            characterId: tempChar.id,
            promptId: comfyJob.promptId,
            promptPackId: promptPack.id,
          })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'BATCH_CANDIDATE_PREVIEW_ERROR' })
        } finally { runtime?.close?.() }
      })

      server.middlewares.use('/api/batch-candidate-preview-image', async (req, res) => {
        if (req.method !== 'POST') { sendJsonMiddleware(res, 405, { error: 'Method not allowed' }); return }
        let runtime = null
        try {
          assertCharacterBatchOperationAllowed('candidate-preview-image', env)
          const body = await readJsonBody(req)
          const { candidateId, previewImageUrl } = body || {}
          if (!candidateId) { sendJsonMiddleware(res, 400, { error: 'Missing candidateId' }); return }
          runtime = createVectorRuntime({ env })
          const updated = updateBatchCandidate(runtime.db, candidateId, { previewImageUrl: previewImageUrl || null })
          if (!updated) { sendJsonMiddleware(res, 404, { error: 'Candidate not found' }); return }
          sendJsonMiddleware(res, 200, { ok: true, item: updated })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'BATCH_CANDIDATE_PREVIEW_IMAGE_ERROR' })
        } finally { runtime?.close?.() }
      })

      server.middlewares.use('/api/character-batch-candidate-mutate', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertCharacterBatchOperationAllowed('candidate-mutate', env)
          const body = await readJsonBody(req)
          runtime = createVectorRuntime({ env })
          const llmGenerate = async ({ system, user, providerPayload }) => {
            const providerSelection = await resolveProviderSelection({
              engine: providerPayload?.engine,
              localOnly: false,
              fetchImpl: fetch,
              env,
              payload: providerPayload || {},
            })
            return runWithResolvedProvider({
              provider: providerSelection.provider,
              userMessage: user,
              payload: providerPayload || {},
              fetchImpl: fetch,
              env,
              systemPrompt: system,
            })
          }
          const result = await mutateBatchCandidate({
            db: runtime.db,
            candidateId: body?.candidateId,
            reason: body?.reason,
            mutationInstructions: body?.mutationInstructions,
            provider: body?.provider,
            llmGenerate,
            vectorStore: runtime.vectorStore,
            embeddingProvider: runtime.embeddingProvider,
          })
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_BATCH_CANDIDATE_MUTATE_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/character-batch-refill', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertCharacterBatchOperationAllowed('batch-refill', env)
          const body = await readJsonBody(req)
          runtime = createVectorRuntime({ env })
          const llmGenerate = async ({ system, user, providerPayload }) => {
            const providerSelection = await resolveProviderSelection({
              engine: providerPayload?.engine,
              localOnly: false,
              fetchImpl: fetch,
              env,
              payload: providerPayload || {},
            })
            return runWithResolvedProvider({
              provider: providerSelection.provider,
              userMessage: user,
              payload: providerPayload || {},
              fetchImpl: fetch,
              env,
              systemPrompt: system,
            })
          }
          const result = await refillCharacterBatch({
            db: runtime.db,
            batchId: body?.batchId,
            targetCount: body?.targetCount,
            maxNewCandidates: body?.maxNewCandidates,
            provider: body?.provider,
            options: body?.options,
            llmGenerate,
            vectorStore: runtime.vectorStore,
            embeddingProvider: runtime.embeddingProvider,
          })
          recalculateCharacterBatchSummary({ db: runtime.db, batchId: body?.batchId })
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_BATCH_REFILL_ERROR' })
        }
      })

      server.middlewares.use('/api/character-bank', async (req, res) => {
        let runtime = null
        try {
          const url = new URL(req.url || '', 'http://localhost')
          runtime = createVectorRuntime({ env })
          if (req.method === 'GET') {
            const id = url.searchParams.get('id')
            const slug = url.searchParams.get('slug')
            if (id) {
              const item = getBankEntry(runtime.db, id)
              if (!item) { sendJsonMiddleware(res, 404, { error: 'Not found' }); return }
              sendJsonMiddleware(res, 200, { ok: true, item })
              return
            }
            if (slug) {
              const item = getBankEntryBySlug(runtime.db, slug)
              if (!item) { sendJsonMiddleware(res, 404, { error: 'Not found' }); return }
              sendJsonMiddleware(res, 200, { ok: true, item })
              return
            }
            const items = listBankEntries(runtime.db, {})
            sendJsonMiddleware(res, 200, { ok: true, items })
            return
          }
          if (req.method === 'POST') {
            const body = await readJsonBody(req)
            try {
              const item = createBankEntry(runtime.db, body || {})
              sendJsonMiddleware(res, 200, { ok: true, item })
              return
            } catch (err) {
              if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                sendJsonMiddleware(res, 409, { error: 'Slug already exists', code: 'SLUG_COLLISION' })
                return
              }
              throw err
            }
          }
          if (req.method === 'PUT') {
            const body = await readJsonBody(req)
            const id = body?.id
            if (!id) { sendJsonMiddleware(res, 400, { error: 'Missing id' }); return }
            const { id: _ignored, ...patch } = body
            try {
              const item = updateBankEntry(runtime.db, id, patch)
              if (!item) { sendJsonMiddleware(res, 404, { error: 'Not found' }); return }
              sendJsonMiddleware(res, 200, { ok: true, item })
              return
            } catch (err) {
              if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                sendJsonMiddleware(res, 409, { error: 'Slug already exists', code: 'SLUG_COLLISION' })
                return
              }
              throw err
            }
          }
          if (req.method === 'DELETE') {
            const id = url.searchParams.get('id')
            if (!id) { sendJsonMiddleware(res, 400, { error: 'Missing id' }); return }
            const deleted = deleteBankEntry(runtime.db, id)
            if (!deleted) { sendJsonMiddleware(res, 404, { error: 'Not found' }); return }
            sendJsonMiddleware(res, 200, { ok: true, deleted: true })
            return
          }
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_BANK_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/actor-candidates', async (req, res) => {
        let runtime = null
        try {
          const url = new URL(req.url || '', 'http://localhost')
          runtime = createVectorRuntime({ env })
          if (req.method === 'GET') {
            const id = url.searchParams.get('id')
            if (id) {
              const item = getActorCandidate(runtime.db, id)
              if (!item) { sendJsonMiddleware(res, 404, { error: 'Not found' }); return }
              sendJsonMiddleware(res, 200, { ok: true, item })
              return
            }
            const filters = {
              status: url.searchParams.get('status') || undefined,
              sourceBankEntryId: url.searchParams.get('sourceBankEntryId') || undefined,
              promptPackId: url.searchParams.get('promptPackId') || undefined,
            }
            const items = listActorCandidates(runtime.db, filters)
            sendJsonMiddleware(res, 200, { ok: true, items })
            return
          }
          if (req.method === 'POST') {
            const body = await readJsonBody(req)
            const item = createActorCandidate(runtime.db, body || {})
            sendJsonMiddleware(res, 200, { ok: true, item })
            return
          }
          if (req.method === 'PUT') {
            const body = await readJsonBody(req)
            const id = body?.id
            if (!id) { sendJsonMiddleware(res, 400, { error: 'Missing id' }); return }
            const { id: _ignored, ...patch } = body
            const item = updateActorCandidate(runtime.db, id, patch)
            if (!item) { sendJsonMiddleware(res, 404, { error: 'Not found' }); return }
            sendJsonMiddleware(res, 200, { ok: true, item })
            return
          }
          if (req.method === 'DELETE') {
            const id = url.searchParams.get('id')
            if (!id) { sendJsonMiddleware(res, 400, { error: 'Missing id' }); return }
            const deleted = deleteActorCandidate(runtime.db, id)
            if (!deleted) { sendJsonMiddleware(res, 404, { error: 'Not found' }); return }
            sendJsonMiddleware(res, 200, { ok: true, deleted: true })
            return
          }
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'ACTOR_CANDIDATE_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/actor-auditions', async (req, res) => {
        let runtime = null
        try {
          const url = new URL(req.url || '', 'http://localhost')
          runtime = createVectorRuntime({ env })
          if (req.method === 'GET') {
            const id = url.searchParams.get('id')
            if (id) {
              const item = getActorAudition(runtime.db, id)
              if (!item) { sendJsonMiddleware(res, 404, { error: 'Not found' }); return }
              sendJsonMiddleware(res, 200, { ok: true, item })
              return
            }
            const filters = {
              actorCandidateId: url.searchParams.get('actorCandidateId') || undefined,
              bankEntryId: url.searchParams.get('bankEntryId') || undefined,
              status: url.searchParams.get('status') || undefined,
            }
            const items = listActorAuditions(runtime.db, filters)
            sendJsonMiddleware(res, 200, { ok: true, items })
            return
          }
          if (req.method === 'POST') {
            const body = await readJsonBody(req)
            try {
              const item = createActorAudition(runtime.db, body || {})
              sendJsonMiddleware(res, 200, { ok: true, item })
              return
            } catch (err) {
              if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                sendJsonMiddleware(res, 409, { error: 'Audition already exists for this actor and character', code: 'AUDITION_EXISTS' })
                return
              }
              throw err
            }
          }
          if (req.method === 'PUT') {
            const body = await readJsonBody(req)
            const id = body?.id
            if (!id) { sendJsonMiddleware(res, 400, { error: 'Missing id' }); return }
            const { id: _ignored, ...patch } = body
            const item = updateActorAudition(runtime.db, id, patch)
            if (!item) { sendJsonMiddleware(res, 404, { error: 'Not found' }); return }
            sendJsonMiddleware(res, 200, { ok: true, item })
            return
          }
          if (req.method === 'DELETE') {
            const id = url.searchParams.get('id')
            if (!id) { sendJsonMiddleware(res, 400, { error: 'Missing id' }); return }
            const deleted = deleteActorAudition(runtime.db, id)
            if (!deleted) { sendJsonMiddleware(res, 404, { error: 'Not found' }); return }
            sendJsonMiddleware(res, 200, { ok: true, deleted: true })
            return
          }
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'ACTOR_AUDITION_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/audition/generate', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          const body = await readJsonBody(req)
          const bankEntryId = body?.bankEntryId
          if (!bankEntryId) {
            sendJsonMiddleware(res, 400, { error: 'Missing bankEntryId' })
            return
          }
          const count = Number.isFinite(body?.count) ? body.count : 3
          const views = Array.isArray(body?.views) && body.views.length > 0
            ? body.views
            : ['front_portrait', 'profile_portrait']
          const workflowId = typeof body?.workflowId === 'string' && body.workflowId.trim()
            ? body.workflowId.trim()
            : undefined

          runtime = createVectorRuntime({ env })

          const llmGenerate = async ({ system, user, providerPayload }) => {
            const providerSelection = await resolveProviderSelection({
              engine: providerPayload?.engine,
              localOnly: false,
              fetchImpl: fetch,
              env,
              payload: providerPayload || {},
            })
            return runWithResolvedProvider({
              provider: providerSelection.provider,
              userMessage: user,
              payload: providerPayload || {},
              fetchImpl: fetch,
              env,
              systemPrompt: system,
            })
          }

          let comfyService = null
          try {
            comfyService = createComfyService({ env })
          } catch (comfyErr) {
            // Comfy unavailable; orchestrator will skip queueing gracefully.
            comfyService = null
          }

          const result = await runAudition({
            db: runtime.db,
            bankEntryId,
            count,
            views,
            workflowId,
            llmGenerate,
            comfyService,
          })
          sendJsonMiddleware(res, 200, { ok: true, ...result })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'AUDITION_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/prompt-pack-compile-character', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertPromptPackOperationAllowed('compile-character', env)
          const body = await readJsonBody(req)
          runtime = createVectorRuntime({ env })
          const result = compileCharacterPromptPacks({ db: runtime.db, input: body || {} })
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'PROMPT_PACK_COMPILE_CHARACTER_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/prompt-pack-compile-batch', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertPromptPackOperationAllowed('compile-batch', env)
          const body = await readJsonBody(req)
          runtime = createVectorRuntime({ env })
          const result = compileBatchPromptPacks({ db: runtime.db, input: body || {} })
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'PROMPT_PACK_COMPILE_BATCH_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/prompt-packs', async (req, res) => {
        if (req.method !== 'GET') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertPromptPackOperationAllowed('list', env)
          const url = new URL(req.url || '', 'http://localhost')
          const characterId = url.searchParams.get('characterId') || ''
          runtime = createVectorRuntime({ env })
          const result = listPromptPacksForCharacter({ db: runtime.db, characterId })
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'PROMPT_PACK_LIST_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/character-portfolio-plan', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertPromptPackOperationAllowed('compile-character', env)
          const body = await readJsonBody(req)
          runtime = createVectorRuntime({ env })
          const result = generateCharacterPortfolioPlan({
            db: runtime.db,
            characterId: body?.characterId,
            views: body?.views,
            workflowId: body?.workflowId,
            options: body?.options || {},
          })
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_PORTFOLIO_PLAN_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/character-portfolio-queue', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertPromptPackOperationAllowed('compile-character', env)
          assertComfyOperationAllowed('queue', env)
          const body = await readJsonBody(req)
          runtime = createVectorRuntime({ env })
          const service = createComfyService({ env })
          const result = await queueCharacterPortfolio({
            db: runtime.db,
            comfyService: service,
            characterId: body?.characterId,
            views: body?.views,
            workflowId: body?.workflowId,
            options: body?.options || {},
          })
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'CHARACTER_PORTFOLIO_QUEUE_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/actor-more-takes', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertPromptPackOperationAllowed('compile-character', env)
          assertComfyOperationAllowed('queue', env)
          const body = await readJsonBody(req)
          runtime = createVectorRuntime({ env })

          let characterId = body?.characterId ?? null
          if (!characterId && body?.actorCandidateId) {
            const candidate = getActorCandidate(runtime.db, body.actorCandidateId)
            if (!candidate) {
              sendJsonMiddleware(res, 404, { error: 'Actor candidate not found' })
              return
            }
            try {
              const notesData = typeof candidate.notes === 'string' ? JSON.parse(candidate.notes) : candidate.notes
              characterId = notesData?.characterId ?? null
            } catch {
              sendJsonMiddleware(res, 422, { error: 'Actor candidate notes do not contain a characterId' })
              return
            }
          }

          if (!characterId) {
            sendJsonMiddleware(res, 400, { error: 'characterId or actorCandidateId is required' })
            return
          }

          const service = createComfyService({ env })
          const result = await queueCharacterPortfolio({
            db: runtime.db,
            comfyService: service,
            characterId,
            views: body?.views,
            workflowId: body?.workflowId,
            options: body?.options || {},
          })
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'ACTOR_MORE_TAKES_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/comfy-status', async (req, res) => {
        if (req.method !== 'GET') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        try {
          assertComfyOperationAllowed('status', env)
          if (String(env.APP_MODE || 'local-studio') === 'cloud') {
            sendJsonMiddleware(res, 200, { ok: true, comfy: { available: false, baseUrl: null } })
            return
          }
          const service = createComfyService({ env })
          sendJsonMiddleware(res, 200, { ok: true, comfy: await service.healthCheck() })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'COMFY_STATUS_ERROR' })
        }
      })

      server.middlewares.use('/api/comfy-workflows', async (req, res) => {
        if (req.method !== 'GET') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        try {
          assertComfyOperationAllowed('status', env)
          const service = createComfyService({ env })
          sendJsonMiddleware(res, 200, service.listWorkflows())
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'COMFY_WORKFLOWS_ERROR' })
        }
      })

      server.middlewares.use('/api/comfy-validate-workflow', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        try {
          assertComfyOperationAllowed('status', env)
          const body = await readJsonBody(req)
          const workflowId = typeof body?.workflowId === 'string' && body.workflowId.trim()
            ? body.workflowId.trim()
            : undefined
          const service = createComfyService({ env })
          sendJsonMiddleware(res, 200, service.validateWorkflow(workflowId))
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'COMFY_VALIDATE_WORKFLOW_ERROR' })
        }
      })

      server.middlewares.use('/api/comfy-queue-prompt-pack', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertComfyOperationAllowed('queue', env)
          const body = await readJsonBody(req)
          runtime = createVectorRuntime({ env })
          const service = createComfyService({ env })
          const result = await service.queuePromptPackById({
            db: runtime.db,
            promptPackId: body?.promptPackId,
            seed: body?.seed,
            workflowId: body?.workflowId,
            allowWorkflowFallback: body?.allowWorkflowFallback === true,
            dimensions: body?.dimensions,
            dryRun: body?.dryRun === true,
          })
          sendJsonMiddleware(res, 200, { ok: true, ...result })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'COMFY_QUEUE_PROMPT_PACK_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/comfy-queue-character', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertComfyOperationAllowed('queue', env)
          const body = await readJsonBody(req)
          runtime = createVectorRuntime({ env })
          const service = createComfyService({ env })
          const result = await service.queueCharacter({
            db: runtime.db,
            characterId: body?.characterId,
            views: Array.isArray(body?.views) ? body.views : [],
            options: body?.options || {},
          })
          sendJsonMiddleware(res, 200, { ok: true, ...result })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'COMFY_QUEUE_CHARACTER_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/comfy-job-status', async (req, res) => {
        if (req.method !== 'GET') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        try {
          assertComfyOperationAllowed('read-job', env)
          const url = new URL(req.url || '', 'http://localhost')
          const promptId = url.searchParams.get('id') || ''
          if (!promptId) {
            sendJsonMiddleware(res, 400, { error: 'Missing id' })
            return
          }
          const service = createComfyService({ env })
          sendJsonMiddleware(res, 200, { ok: true, ...(await service.getJobStatus(promptId)) })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'COMFY_JOB_STATUS_ERROR' })
        }
      })

      server.middlewares.use('/api/comfy-jobs-status', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        try {
          assertComfyOperationAllowed('read-job', env)
          const body = await readJsonBody(req)
          const jobs = Array.isArray(body?.jobs) ? body.jobs : []
          const service = createComfyService({ env })
          const items = []
          for (const job of jobs) {
            const promptId = typeof job?.promptId === 'string' ? job.promptId : ''
            const promptPackId = typeof job?.promptPackId === 'string' ? job.promptPackId : ''
            const view = typeof job?.view === 'string' ? job.view : 'other'
            if (!promptId) {
              items.push({ promptId: '', promptPackId, view, ok: false, error: 'Missing promptId' })
              continue
            }
            try {
              const raw = await service.getJobStatus(promptId)
              const historyEntry = raw?.history?.[promptId]
              const statusStr = historyEntry?.status?.status_str
              const running = Array.isArray(raw?.queue?.queue_running)
                ? raw.queue.queue_running.some((entry) => entry?.[1] === promptId)
                : false
              const status = statusStr === 'success'
                ? 'success'
                : statusStr === 'error'
                  ? 'failed'
                  : running
                    ? 'running'
                    : 'unknown'
              items.push({ promptId, promptPackId, view, ok: true, status, raw })
            } catch (err) {
              items.push({ promptId, promptPackId, view, ok: false, error: err?.message || 'Status check failed' })
            }
          }
          sendJsonMiddleware(res, 200, {
            ok: true,
            items,
            summary: {
              total: items.length,
              success: items.filter((x) => x.status === 'success').length,
              failed: items.filter((x) => x.status === 'failed' || x.ok === false).length,
              running: items.filter((x) => x.status === 'running').length,
              unknown: items.filter((x) => x.status === 'unknown').length,
            },
          })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'COMFY_JOBS_STATUS_ERROR' })
        }
      })

      server.middlewares.use('/api/comfy-jobs', async (req, res) => {
        let runtime = null
        try {
          runtime = createVectorRuntime({ env })
          if (req.method === 'GET') {
            const jobType = typeof req.query?.jobType === 'string' ? req.query.jobType : undefined
            const jobs = listActiveComfyJobs(runtime.db, jobType)
            return sendJsonMiddleware(res, 200, { ok: true, jobs })
          }
          if (req.method === 'POST') {
            const body = await readJsonBody(req)
            const jobs = Array.isArray(body?.jobs) ? body.jobs : []
            if (!jobs.length) return sendJsonMiddleware(res, 400, { error: 'jobs array required' })
            bulkUpsertComfyJobs(runtime.db, jobs)
            return sendJsonMiddleware(res, 200, { ok: true, count: jobs.length })
          }
          if (req.method === 'PATCH') {
            const body = await readJsonBody(req)
            const { promptIds, status } = body || {}
            if (!Array.isArray(promptIds) || !status) return sendJsonMiddleware(res, 400, { error: 'promptIds and status required' })
            bulkUpdateComfyJobStatus(runtime.db, promptIds, status)
            return sendJsonMiddleware(res, 200, { ok: true })
          }
          return sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
        } catch (err) {
          sendJsonMiddleware(res, 500, { error: err?.message || 'comfy-jobs error' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/comfy-ingest-outputs', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertComfyOperationAllowed('ingest', env)
          const body = await readJsonBody(req)
          if (!body?.promptId || !body?.promptPackId) {
            sendJsonMiddleware(res, 400, { error: 'Missing promptId or promptPackId' })
            return
          }
          runtime = createVectorRuntime({ env })
          const promptPack = getPromptPack(runtime.db, body.promptPackId)
          if (!promptPack) {
            sendJsonMiddleware(res, 404, { error: 'Prompt pack not found' })
            return
          }
          const service = createComfyService({ env })
          const status = await service.getJobStatus(body.promptId)
          const items = service.ingestHistoryOutputs({
            db: runtime.db,
            promptId: body.promptId,
            promptPack,
            characterId: body.characterId || promptPack.characterId,
            viewType: body.viewType || 'other',
            workflowVersion: body.workflowVersion || promptPack.comfyWorkflowId || 'qwen-image-2512-default',
            historyPayload: status.history,
          })
          sendJsonMiddleware(res, 200, { ok: true, created: items.length, items })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'COMFY_INGEST_OUTPUTS_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/comfy-ingest-many', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertComfyOperationAllowed('ingest', env)
          const body = await readJsonBody(req)
          const jobs = Array.isArray(body?.jobs) ? body.jobs : []
          runtime = createVectorRuntime({ env })
          const service = createComfyService({ env })
          const items = []
          for (const job of jobs) {
            const promptId = typeof job?.promptId === 'string' ? job.promptId : ''
            const promptPackId = typeof job?.promptPackId === 'string' ? job.promptPackId : ''
            if (!promptId || !promptPackId) {
              items.push({ promptId, promptPackId, ok: false, error: 'Missing promptId or promptPackId' })
              continue
            }
            try {
              const promptPack = getPromptPack(runtime.db, promptPackId)
              if (!promptPack) {
                items.push({ promptId, promptPackId, ok: false, error: 'Prompt pack not found' })
                continue
              }
              const raw = await service.getJobStatus(promptId)
              const statusStr = raw?.history?.[promptId]?.status?.status_str
              const running = Array.isArray(raw?.queue?.queue_running)
                ? raw.queue.queue_running.some((entry) => entry?.[1] === promptId)
                : false
              const status = statusStr === 'success'
                ? 'success'
                : statusStr === 'error'
                  ? 'failed'
                  : running
                    ? 'running'
                    : 'unknown'
              if (status !== 'success') {
                items.push({ promptId, promptPackId, ok: false, status, error: 'Job not completed successfully' })
                continue
              }
              const created = service.ingestHistoryOutputs({
                db: runtime.db,
                promptId,
                promptPack,
                characterId: job?.characterId || promptPack.characterId,
                viewType: job?.viewType || 'other',
                workflowVersion: job?.workflowVersion || promptPack.comfyWorkflowId || 'qwen-image-2512-default',
                historyPayload: raw.history,
              })
              items.push({ promptId, promptPackId, ok: true, created: created.length, records: created })
            } catch (err) {
              items.push({ promptId, promptPackId, ok: false, error: err?.message || 'Ingest failed' })
            }
          }
          sendJsonMiddleware(res, 200, {
            ok: true,
            items,
            summary: {
              total: items.length,
              success: items.filter((x) => x.ok).length,
              failed: items.filter((x) => !x.ok).length,
              createdRecords: items.reduce((sum, x) => sum + (x.created || 0), 0),
            },
          })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'COMFY_INGEST_MANY_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/generated-images', async (req, res) => {
        if (req.method !== 'GET') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertGeneratedImagesOperationAllowed('list', env)
          const url = new URL(req.url || '', 'http://localhost')
          const limit = Number.parseInt(url.searchParams.get('limit') || '', 10)
          runtime = createVectorRuntime({ env })
          const items = listGeneratedImageRecords(runtime.db, {
            characterId: url.searchParams.get('characterId') || undefined,
            promptPackId: url.searchParams.get('promptPackId') || undefined,
            viewType: url.searchParams.get('viewType') || undefined,
            approved: url.searchParams.get('approved') === 'true'
              ? true
              : url.searchParams.get('approved') === 'false'
                ? false
                : undefined,
            limit: Number.isFinite(limit) ? limit : undefined,
          })
          sendJsonMiddleware(res, 200, { ok: true, items })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'GENERATED_IMAGES_LIST_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/generated-image-approve', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertGeneratedImagesOperationAllowed('approve', env)
          const body = await readJsonBody(req)
          if (!body?.id) {
            sendJsonMiddleware(res, 400, { error: 'Missing id' })
            return
          }
          runtime = createVectorRuntime({ env })
          const item = updateGeneratedImageRecord(runtime.db, body.id, {
            approved: true,
            rejectedReason: undefined,
          })
          if (!item) {
            sendJsonMiddleware(res, 404, { error: 'Generated image not found' })
            return
          }
          sendJsonMiddleware(res, 200, { ok: true, item })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'GENERATED_IMAGE_APPROVE_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/generated-image-reject', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertGeneratedImagesOperationAllowed('reject', env)
          const body = await readJsonBody(req)
          if (!body?.id) {
            sendJsonMiddleware(res, 400, { error: 'Missing id' })
            return
          }
          runtime = createVectorRuntime({ env })
          const item = updateGeneratedImageRecord(runtime.db, body.id, {
            approved: false,
            rejectedReason: typeof body.rejectedReason === 'string' && body.rejectedReason.trim()
              ? body.rejectedReason.trim()
              : undefined,
          })
          if (!item) {
            sendJsonMiddleware(res, 404, { error: 'Generated image not found' })
            return
          }
          sendJsonMiddleware(res, 200, { ok: true, item })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'GENERATED_IMAGE_REJECT_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/generated-image-view', async (req, res) => {
        if (req.method !== 'GET') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertGeneratedImagesOperationAllowed('view', env)
          const url = new URL(req.url || '', 'http://localhost')
          const id = url.searchParams.get('id') || ''
          if (!id) {
            sendJsonMiddleware(res, 400, { error: 'Missing id' })
            return
          }
          runtime = createVectorRuntime({ env })
          const record = getGeneratedImageRecord(runtime.db, id)
          if (!record) {
            sendJsonMiddleware(res, 404, { error: 'Generated image not found' })
            return
          }
          const comfyImage = record.comfyImage?.filename
            ? {
              filename: record.comfyImage.filename,
              subfolder: record.comfyImage.subfolder || '',
              type: record.comfyImage.type || 'output',
            }
            : (() => {
              const imagePath = typeof record.imagePath === 'string' ? record.imagePath.trim() : ''
              const parts = imagePath.replace(/\\/g, '/').split('/').filter(Boolean)
              if (!parts.length) return null
              return {
                filename: parts[parts.length - 1],
                subfolder: parts.slice(0, -1).join('/'),
                type: 'output',
              }
            })()
          if (!comfyImage?.filename) {
            sendJsonMiddleware(res, 400, { error: 'Could not resolve Comfy image metadata for this record.' })
            return
          }
          const baseUrl = (env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188').replace(/\/+$/, '')
          const viewUrl = new URL(`${baseUrl}/view`)
          viewUrl.searchParams.set('filename', comfyImage.filename)
          viewUrl.searchParams.set('subfolder', comfyImage.subfolder || '')
          viewUrl.searchParams.set('type', comfyImage.type || 'output')
          const response = await fetch(viewUrl.toString())
          if (!response.ok) {
            sendJsonMiddleware(res, 502, { error: `Comfy image view request failed: ${response.status}` })
            return
          }
          const contentType = response.headers.get('content-type') || 'application/octet-stream'
          const bytes = Buffer.from(await response.arrayBuffer())
          res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' })
          res.end(bytes)
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'GENERATED_IMAGE_VIEW_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/vector-status', async (req, res) => {
        if (req.method !== 'GET') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertVectorOperationAllowed('status', env)
          if (String(env.APP_MODE || 'local-studio') === 'cloud') {
            sendJsonMiddleware(res, 200, {
              sqlite: { available: false, dbPath: null },
              chroma: {
                available: false,
                collection: env.CHROMA_COLLECTION_CHARACTERS || 'characters',
              },
              embeddings: {
                available: false,
                provider: 'ollama',
                model: env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
              },
              characters: {
                total: 0,
                byEmbeddingStatus: { not_indexed: 0, pending: 0, embedded: 0, failed: 0 },
              },
            })
            return
          }
          runtime = createVectorRuntime({ env })
          const raw = await getVectorStatus({
            db: runtime.db,
            vectorStore: runtime.vectorStore,
            embeddingProvider: runtime.embeddingProvider,
            env,
          })
          const result = sanitizeVectorStatusForMode(raw, env)
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'VECTOR_STATUS_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/vector-index-character', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertVectorOperationAllowed('index-character', env)
          const body = await readJsonBody(req)
          const parsed = parseIndexCharacterRequest(body)
          runtime = createVectorRuntime({ env })
          const result = await indexCharacterById({
            db: runtime.db,
            vectorStore: runtime.vectorStore,
            embeddingProvider: runtime.embeddingProvider,
            id: parsed.id,
          })
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'VECTOR_INDEX_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/vector-reindex-characters', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertVectorOperationAllowed('reindex-characters', env)
          const body = await readJsonBody(req)
          const parsed = parseReindexRequest(body)
          runtime = createVectorRuntime({ env })
          const result = await reindexCharacters({
            db: runtime.db,
            vectorStore: runtime.vectorStore,
            embeddingProvider: runtime.embeddingProvider,
            filters: parsed,
          })
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'VECTOR_REINDEX_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/vector-similar-by-character', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertVectorOperationAllowed('similar-by-character', env)
          const body = await readJsonBody(req)
          const parsed = parseSimilarByCharacterRequest(body)
          runtime = createVectorRuntime({ env })
          const result = await findSimilarCharactersById({
            db: runtime.db,
            vectorStore: runtime.vectorStore,
            embeddingProvider: runtime.embeddingProvider,
            id: parsed.id,
            limit: parsed.limit,
          })
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'VECTOR_SIMILAR_BY_CHARACTER_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/vector-similar-by-text', async (req, res) => {
        if (req.method !== 'POST') {
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
          return
        }
        let runtime = null
        try {
          assertVectorOperationAllowed('similar-by-text', env)
          const body = await readJsonBody(req)
          const parsed = parseSimilarByTextRequest(body)
          runtime = createVectorRuntime({ env })
          const result = await findSimilarCharactersByText({
            vectorStore: runtime.vectorStore,
            embeddingProvider: runtime.embeddingProvider,
            text: parsed.text,
            limit: parsed.limit,
          })
          sendJsonMiddleware(res, 200, result)
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message, code: err?.code || 'VECTOR_SIMILAR_BY_TEXT_ERROR' })
        } finally {
          runtime?.close?.()
        }
      })
      server.middlewares.use('/api/saved-prompts', async (req, res) => {
        let runtime = null
        try {
          runtime = createVectorRuntime({ env })
          const url = new URL(req.url || '', 'http://localhost')
          if (req.method === 'GET') {
            sendJsonMiddleware(res, 200, { ok: true, items: listSavedPrompts(runtime.db) })
            return
          }
          if (req.method === 'POST') {
            const body = await readJsonBody(req)
            const item = createSavedPrompt(runtime.db, body || {})
            sendJsonMiddleware(res, 200, { ok: true, item })
            return
          }
          if (req.method === 'DELETE') {
            const id = url.searchParams.get('id') || ''
            if (!id) { sendJsonMiddleware(res, 400, { error: 'Missing id' }); return }
            const deleted = deleteSavedPrompt(runtime.db, id)
            if (!deleted) { sendJsonMiddleware(res, 404, { error: 'Not found' }); return }
            sendJsonMiddleware(res, 200, { ok: true })
            return
          }
          if (req.method === 'PATCH') {
            const body = await readJsonBody(req)
            if (!body?.id || !body?.name) { sendJsonMiddleware(res, 400, { error: 'Missing id or name' }); return }
            const item = renameSavedPrompt(runtime.db, body.id, body.name)
            if (!item) { sendJsonMiddleware(res, 404, { error: 'Not found' }); return }
            sendJsonMiddleware(res, 200, { ok: true, item })
            return
          }
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message })
        } finally {
          runtime?.close?.()
        }
      })

      server.middlewares.use('/api/workspace-profiles', async (req, res) => {
        let runtime = null
        try {
          runtime = createVectorRuntime({ env })
          const url = new URL(req.url || '', 'http://localhost')
          if (req.method === 'GET') {
            sendJsonMiddleware(res, 200, { ok: true, items: listWorkspaceProfiles(runtime.db) })
            return
          }
          if (req.method === 'PUT') {
            const body = await readJsonBody(req)
            if (!body?.id || !body?.label) { sendJsonMiddleware(res, 400, { error: 'Missing id or label' }); return }
            const item = upsertWorkspaceProfile(runtime.db, { id: body.id, label: body.label, stateJson: JSON.stringify(body.state ?? {}) })
            sendJsonMiddleware(res, 200, { ok: true, item })
            return
          }
          if (req.method === 'DELETE') {
            const id = url.searchParams.get('id') || ''
            if (!id) { sendJsonMiddleware(res, 400, { error: 'Missing id' }); return }
            const deleted = deleteWorkspaceProfile(runtime.db, id)
            if (!deleted) { sendJsonMiddleware(res, 404, { error: 'Not found' }); return }
            sendJsonMiddleware(res, 200, { ok: true })
            return
          }
          sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
        } catch (err) {
          const normalized = normalizeHandlerError(err)
          sendJsonMiddleware(res, normalized.status, { error: normalized.message })
        } finally {
          runtime?.close?.()
        }
      })

    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), apiDevPlugin(env)],
    test: {
      exclude: ['node_modules/**', '.claude/worktrees/**'],
    },
  }
})
