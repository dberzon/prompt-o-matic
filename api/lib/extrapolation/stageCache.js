import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_CACHE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../data/extrapolation-stage-cache',
)

function hashKey({ entityId, snapshot, stageId, modelId }) {
  return createHash('sha256')
    .update(JSON.stringify({ entityId, snapshot, stageId, modelId }))
    .digest('hex')
}

export class StageCache {
  constructor({ cacheDir = process.env.EXTRAPOLATION_STAGE_CACHE_DIR || DEFAULT_CACHE_DIR } = {}) {
    this.cacheDir = cacheDir
    fs.mkdirSync(this.cacheDir, { recursive: true })
  }

  get({ entityId, snapshot, stageId, modelId }) {
    const key = hashKey({ entityId, snapshot, stageId, modelId })
    const filePath = path.join(this.cacheDir, `${key}.json`)
    if (!fs.existsSync(filePath)) return null
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch {
      return null
    }
  }

  set({ entityId, snapshot, stageId, modelId, result }) {
    const key = hashKey({ entityId, snapshot, stageId, modelId })
    const filePath = path.join(this.cacheDir, `${key}.json`)
    fs.writeFileSync(filePath, JSON.stringify({
      entityId,
      snapshot,
      stageId,
      modelId,
      cachedAt: new Date().toISOString(),
      result,
    }, null, 2))
    return key
  }
}

export function buildCanonSnapshot(attributes) {
  const rows = Array.isArray(attributes) ? attributes : []
  return rows
    .filter((item) => item?.provenance === 'canon' && !item?.supersededBy && !item?.dismissedAt)
    .map((item) => ({ key: item.key, value: item.value }))
    .sort((a, b) => a.key.localeCompare(b.key))
}
