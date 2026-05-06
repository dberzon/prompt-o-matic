import { describe, expect, it } from 'vitest'
import {
  assertVectorMaintenanceEnabled,
  assertVectorOperationAllowed,
  sanitizeVectorStatusForMode,
} from './access.js'

describe('vector maintenance access guards', () => {
  it('blocks in cloud mode when flag not set', () => {
    expect(() => assertVectorMaintenanceEnabled({ APP_MODE: 'cloud' })).toThrow('Vector maintenance API is disabled')
  })

  it('allows in local-studio mode without flag', () => {
    expect(() => assertVectorMaintenanceEnabled({})).not.toThrow()
  })

  it('blocks non-status operations in cloud mode', () => {
    expect(() => assertVectorOperationAllowed('reindex-characters', {
      ENABLE_VECTOR_MAINTENANCE_API: 'true',
      APP_MODE: 'cloud',
    })).toThrow('blocked in APP_MODE=cloud')
  })

  it('allows local-studio operations when enabled', () => {
    expect(() => assertVectorOperationAllowed('reindex-characters', {
      ENABLE_VECTOR_MAINTENANCE_API: 'true',
      APP_MODE: 'local-studio',
    })).not.toThrow()
  })

  it('allows status operation in cloud mode when enabled', () => {
    expect(() => assertVectorOperationAllowed('status', {
      ENABLE_VECTOR_MAINTENANCE_API: 'true',
      APP_MODE: 'cloud',
    })).not.toThrow()
  })

  it('redacts sqlite path in cloud status', () => {
    const sanitized = sanitizeVectorStatusForMode({
      sqlite: { available: true, dbPath: '/abs/path/local.sqlite' },
      chroma: { available: true, collection: 'characters' },
      embeddings: { available: true, provider: 'ollama', model: 'nomic-embed-text' },
      characters: {
        total: 1,
        byEmbeddingStatus: { not_indexed: 1, pending: 0, embedded: 0, failed: 0 },
      },
    }, { APP_MODE: 'cloud' })

    expect(sanitized.sqlite.dbPath).toBeNull()
  })
})
