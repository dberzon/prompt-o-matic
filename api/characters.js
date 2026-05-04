import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertCharacterBatchOperationAllowed } from './lib/characters/access.js'
import { listCharacters, deleteCharacter } from './lib/db/repositories.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    let runtime = null
    try {
      assertCharacterBatchOperationAllowed('delete-character', process.env)
      runtime = createVectorRuntime({ env: process.env })
      const id = req.query?.id ?? req.body?.id
      if (!id || typeof id !== 'string') {
        return sendJsonNode(res, 400, { error: 'Missing character id' })
      }
      const deleted = deleteCharacter(runtime.db, id)
      if (!deleted) return sendJsonNode(res, 404, { error: 'Character not found' })
      return sendJsonNode(res, 200, { ok: true })
    } catch (error) {
      const normalized = normalizeHandlerError(error)
      return sendJsonNode(res, normalized.status, { error: normalized.message })
    } finally {
      runtime?.close?.()
    }
  }

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
