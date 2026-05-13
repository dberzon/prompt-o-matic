import { describe, expect, it } from 'vitest'
import { S3PsychologyOutputSchema, parseS3PsychologyOutput } from './s3Psychology.js'

describe('S3PsychologyOutputSchema', () => {
  const happy = { attributes: [{ key: 'behavior.temperament', value: 'wry', confidence: 0.7 }] }

  it('parses orchestrator-aligned happy-path fixture', () => {
    const parsed = parseS3PsychologyOutput(happy)
    expect(parsed.attributes[0].key).toBe('behavior.temperament')
  })

  it('rejects key outside behavior|speech|fear prefixes', () => {
    const result = S3PsychologyOutputSchema.safeParse({
      attributes: [{ key: 'psychology.temperament', value: 'wry' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing value', () => {
    const result = S3PsychologyOutputSchema.safeParse({ attributes: [{ key: 'behavior.x' }] })
    expect(result.success).toBe(false)
  })

  it('rejects unknown extra fields', () => {
    const result = S3PsychologyOutputSchema.safeParse({
      attributes: [{ key: 'behavior.x', value: 'y', z: 1 }],
    })
    expect(result.success).toBe(false)
  })
})
