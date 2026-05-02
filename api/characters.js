import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertCharacterBatchOperationAllowed } from './lib/characters/access.js'
import { listCharacters } from './lib/db/repositories.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertCharacterBatchOperationAllowed('list-characters', process.env)
    runtime = createVectorRuntime({ env: process.env })
    const q = req.query ?? {}
    const projectId = typeof q.projectId === 'string' ? q.projectId : undefined
    const gender = typeof q.gender === 'string' ? q.gender : undefined
    const search = typeof q.search === 'string' ? q.search : undefined
    const ageMin = q.ageMin !== undefined ? Number(q.ageMin) : undefined
    const ageMax = q.ageMax !== undefined ? Number(q.ageMax) : undefined
    const items = listCharacters(runtime.db, {
      projectId,
      gender,
      search,
      ageMin: Number.isFinite(ageMin) ? ageMin : undefined,
      ageMax: Number.isFinite(ageMax) ? ageMax : undefined,
    })
    return sendJsonNode(res, 200, { ok: true, items, total: items.length })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'CHARACTERS_LIST_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
