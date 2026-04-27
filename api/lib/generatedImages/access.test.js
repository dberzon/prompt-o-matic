import { describe, expect, it } from 'vitest'
import { assertGeneratedImagesApiEnabled, assertGeneratedImagesOperationAllowed } from './access.js'

describe('generated images access guards', () => {
  it('blocks when disabled', () => {
    expect(() => assertGeneratedImagesApiEnabled({})).toThrow('Generated images API is disabled')
  })

  it('allows list in cloud mode when enabled', () => {
    expect(() => assertGeneratedImagesOperationAllowed('list', {
      ENABLE_GENERATED_IMAGES_API: 'true',
      APP_MODE: 'cloud',
    })).not.toThrow()
  })

  it('blocks proxy/write operations in cloud mode', () => {
    expect(() => assertGeneratedImagesOperationAllowed('view', {
      ENABLE_GENERATED_IMAGES_API: 'true',
      APP_MODE: 'cloud',
    })).toThrow('blocked in APP_MODE=cloud')
    expect(() => assertGeneratedImagesOperationAllowed('approve', {
      ENABLE_GENERATED_IMAGES_API: 'true',
      APP_MODE: 'cloud',
    })).toThrow('blocked in APP_MODE=cloud')
  })
})

