import { describe, expect, it } from 'vitest'
import { assertCharacterBatchApiEnabled, assertCharacterBatchOperationAllowed } from './access.js'

describe('character batch API access', () => {
  it('blocks when flag disabled', () => {
    expect(() => assertCharacterBatchApiEnabled({})).toThrow('Character batch API is disabled')
  })

  it('allows read operations in cloud when enabled', () => {
    expect(() => assertCharacterBatchOperationAllowed('list-batches', {
      ENABLE_CHARACTER_BATCH_API: 'true',
      APP_MODE: 'cloud',
    })).not.toThrow()
    expect(() => assertCharacterBatchOperationAllowed('list-characters', {
      ENABLE_CHARACTER_BATCH_API: 'true',
      APP_MODE: 'cloud',
    })).not.toThrow()
  })

  it('blocks write operations in cloud', () => {
    expect(() => assertCharacterBatchOperationAllowed('candidate-save', {
      ENABLE_CHARACTER_BATCH_API: 'true',
      APP_MODE: 'cloud',
    })).toThrow('blocked in APP_MODE=cloud')
  })

  it('blocks refill operations in cloud', () => {
    expect(() => assertCharacterBatchOperationAllowed('batch-refill', {
      ENABLE_CHARACTER_BATCH_API: 'true',
      APP_MODE: 'cloud',
    })).toThrow('blocked in APP_MODE=cloud')
  })

  it('allows local operations when enabled', () => {
    expect(() => assertCharacterBatchOperationAllowed('candidate-save', {
      ENABLE_CHARACTER_BATCH_API: 'true',
      APP_MODE: 'local-studio',
    })).not.toThrow()
  })
})
