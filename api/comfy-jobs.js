import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { createSqliteDatabase } from './lib/db/sqlite.js'
import { initializeDatabase } from './lib/db/schema.js'
import { listActiveComfyJobs, bulkUpsertComfyJobs, bulkUpdateComfyJobStatus } from './lib/db/repositories.js'

function createDb() {
  const db = createSqliteDatabase({ env: process.env })
  initializeDatabase(db)
  return db
}

export default async function handler(req, res) {
  let db = null
  try {
    db = createDb()
    if (req.method === 'GET') {
      const jobType = typeof req.query?.jobType === 'string' ? req.query.jobType : undefined
      const jobs = listActiveComfyJobs(db, jobType)
      return sendJsonNode(res, 200, { ok: true, jobs })
    }
    if (req.method === 'POST') {
      const jobs = Array.isArray(req.body?.jobs) ? req.body.jobs : []
      if (!jobs.length) return sendJsonNode(res, 400, { error: 'jobs array required' })
      bulkUpsertComfyJobs(db, jobs)
      return sendJsonNode(res, 200, { ok: true, count: jobs.length })
    }
    if (req.method === 'PATCH') {
      const { promptIds, status } = req.body || {}
      if (!Array.isArray(promptIds) || !status) return sendJsonNode(res, 400, { error: 'promptIds and status required' })
      bulkUpdateComfyJobStatus(db, promptIds, status)
      return sendJsonNode(res, 200, { ok: true })
    }
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message })
  } finally {
    db?.close?.()
  }
}
