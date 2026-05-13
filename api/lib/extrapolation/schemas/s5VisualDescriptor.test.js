import { describe, expect, it } from 'vitest'
import { S5VisualDescriptorOutputSchema, parseS5VisualDescriptorOutput } from './s5VisualDescriptor.js'

const longEnough = 'frontal portrait, neutral expression'

describe('S5VisualDescriptorOutputSchema', () => {
  it('parses visualDescriptor key', () => {
    const parsed = parseS5VisualDescriptorOutput({ visualDescriptor: longEnough })
    expect(parsed.visualDescriptor).toBe(longEnough)
  })

  it('accepts legacy visual.descriptor key', () => {
    const parsed = parseS5VisualDescriptorOutput({ 'visual.descriptor': longEnough })
    expect(parsed.visualDescriptor).toBe(longEnough)
  })

  it('rejects too-short descriptor', () => {
    const result = S5VisualDescriptorOutputSchema.safeParse({ visualDescriptor: 'short' })
    expect(result.success).toBe(false)
  })
})
