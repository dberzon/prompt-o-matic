import { describe, expect, it } from 'vitest'
import { assertComfyApiEnabled, assertComfyOperationAllowed } from './access.js'

describe('comfy access guards', () => {
  it('blocks when disabled', () => {
    expect(() => assertComfyApiEnabled({})).toThrow('Comfy API is disabled')
  })

  it('allows status in cloud when enabled', () => {
    expect(() => assertComfyOperationAllowed('status', {
      ENABLE_COMFY_API: 'true',
      APP_MODE: 'cloud',
    })).not.toThrow()
  })

  it('blocks queue in cloud mode', () => {
    expect(() => assertComfyOperationAllowed('queue', {
      ENABLE_COMFY_API: 'true',
      APP_MODE: 'cloud',
    })).toThrow('blocked in APP_MODE=cloud')
  })
})
