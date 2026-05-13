import { describe, expect, it } from 'vitest'
import { S2HistoricalOutputSchema, parseS2HistoricalOutput } from './s2Historical.js'

describe('S2HistoricalOutputSchema', () => {
  const happy = { attributes: [{ key: 'culture.slang', value: 'bro', confidence: 0.5 }] }

  it('parses orchestrator happy-path fixture', () => {
    const parsed = parseS2HistoricalOutput(happy)
    expect(parsed.attributes).toHaveLength(1)
    expect(parsed.attributes[0].key).toBe('culture.slang')
  })

  it('rejects missing value', () => {
    const result = S2HistoricalOutputSchema.safeParse({ attributes: [{ key: 'culture.slang' }] })
    expect(result.success).toBe(false)
  })

  it('rejects unknown extra fields on attribute rows', () => {
    const result = S2HistoricalOutputSchema.safeParse({
      attributes: [{ key: 'culture.slang', value: 'bro', extra: 'nope' }],
    })
    expect(result.success).toBe(false)
  })
})
