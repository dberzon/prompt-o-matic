import { describe, expect, it } from 'vitest'
import { ConflictSchema, S6ConflictOutputSchema, parseS6ConflictOutput } from './s6Conflict.js'

/** Same shape as the Ruslan / orchestrator LLM stubs that return no S6 hits (`{ conflicts: [] }`). */
const extrapolationStubEmptyS6 = { conflicts: [] }

describe('S6ConflictOutputSchema', () => {
  it('accepts empty conflicts (matches extrapolation.test.js stub output)', () => {
    const parsed = parseS6ConflictOutput(extrapolationStubEmptyS6)
    expect(parsed.conflicts).toEqual([])
  })

  it('accepts a single conflict', () => {
    const parsed = parseS6ConflictOutput({
      conflicts: [
        {
          keys: ['appearance.height', 'appearance.build'],
          severity: 'medium',
          reason: 'Height implies slight frame but build describes heavy-set.',
        },
      ],
    })
    expect(parsed.conflicts).toHaveLength(1)
    expect(parsed.conflicts[0].severity).toBe('medium')
  })

  it('accepts multiple conflicts', () => {
    const parsed = parseS6ConflictOutput({
      conflicts: [
        { keys: ['a', 'b'], severity: 'low', reason: 'r1' },
        { keys: ['x', 'y', 'z'], severity: 'high', reason: 'r2', suggested: 'Prefer canon era attrs.' },
      ],
    })
    expect(parsed.conflicts).toHaveLength(2)
    expect(parsed.conflicts[1].suggested).toContain('canon')
  })

  it('rejects invalid severity', () => {
    const result = S6ConflictOutputSchema.safeParse({
      conflicts: [{ keys: ['a', 'b'], severity: 'critical', reason: 'bad' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects keys with fewer than two entries', () => {
    const result = ConflictSchema.safeParse({
      keys: ['only-one'],
      severity: 'low',
      reason: 'needs two keys minimum',
    })
    expect(result.success).toBe(false)
  })
})
