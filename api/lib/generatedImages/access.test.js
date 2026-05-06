import { describe, expect, it } from 'vitest'
import { assertGeneratedImagesApiEnabled, assertGeneratedImagesOperationAllowed } from './access.js'

describe('generated images access guards', () => {
  it('blocks in cloud mode when flag not set', () => {
    expect(() => assertGeneratedImagesApiEnabled({ APP_MODE: 'cloud' })).toThrow('Generated images API is disabled')
  })

  it('allows in local-studio mode without flag', () => {
    expect(() => assertGeneratedImagesApiEnabled({})).not.toThrow()
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

