import { describe, expect, it } from 'vitest'
import { assertPromptPackApiEnabled, assertPromptPackOperationAllowed } from './access.js'

describe('prompt-pack API access', () => {
  it('blocks when flag disabled', () => {
    expect(() => assertPromptPackApiEnabled({})).toThrow('Prompt-pack API is disabled')
  })

  it('allows list in cloud when enabled', () => {
    expect(() => assertPromptPackOperationAllowed('list', {
      ENABLE_PROMPT_PACK_API: 'true',
      APP_MODE: 'cloud',
    })).not.toThrow()
  })

  it('blocks compile in cloud', () => {
    expect(() => assertPromptPackOperationAllowed('compile-character', {
      ENABLE_PROMPT_PACK_API: 'true',
      APP_MODE: 'cloud',
    })).toThrow('blocked in APP_MODE=cloud')
  })
})
