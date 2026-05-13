import { describe, expect, it } from 'vitest'
import { parseQwenImagePromptPack } from '../characters/schemas.js'
import { buildPromptBuilderPromptPack } from './builderPromptRender.js'

describe('buildPromptBuilderPromptPack', () => {
  it('creates a schema-valid prompt pack for builder renders', () => {
    const pack = buildPromptBuilderPromptPack({
      characterId: 'char_builder_1',
      positivePrompt: 'rain-soaked alley, single figure under neon',
      negativePrompt: 'cgi, illustration',
      aspectRatio: '16:9',
      workflowId: 'qwen-image-2512-default',
    })
    const parsed = parseQwenImagePromptPack(pack)
    expect(parsed.positivePrompt).toContain('rain-soaked alley')
    expect(parsed.negativePrompt).toBe('cgi, illustration')
    expect(parsed.aspectRatio).toBe('16:9')
    expect(parsed.consistencyTags).toContain('prompt_builder')
  })
})
