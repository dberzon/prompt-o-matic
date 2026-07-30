import { describe, expect, it } from 'vitest'
import { ConflictSchema, S6ConflictOutputSchema, parseS6ConflictOutput } from './s6Conflict.js'

/** Same shape as the Ruslan / orchestrator LLM stubs that return no S6 hits (`{ conflicts: [] }`). */
const extrapolationStubEmptyS6 = { conflicts: [] }

describe('S6ConflictOutputSchema', () => {
  it('accepts empty conflicts (matches extrapolation.test.js stub output)', () => {
    const parsed = parseS6ConflictOutput(extrapolationStubEmptyS6)
    expect(parsed.conflicts).toEqual([])
  })

  it('accepts prompt/parser-shaped conflicts with attributeIds', () => {
    const parsed = parseS6ConflictOutput({
      conflicts: [
        {
          key: 'eyes',
          message: 'Height implies slight frame but build describes heavy-set.',
          attributeIds: ['attr_a', 'attr_b'],
        },
      ],
    })
    expect(parsed.conflicts).toHaveLength(1)
    expect(parsed.conflicts[0]).toEqual({
      key: 'eyes',
      message: 'Height implies slight frame but build describes heavy-set.',
      attributeIds: ['attr_a', 'attr_b'],
    })
  })

  it('accepts multiple conflicts', () => {
    const parsed = parseS6ConflictOutput({
      conflicts: [
        { key: 'wardrobe', message: 'r1', attributeIds: ['a', 'b'] },
        { key: 'era', message: 'r2', attributeIds: ['x', 'y', 'z'] },
      ],
    })
    expect(parsed.conflicts).toHaveLength(2)
    expect(parsed.conflicts[1].attributeIds).toEqual(['x', 'y', 'z'])
  })

  it('rejects legacy keys/severity/reason shape (mismatched with parser/UI)', () => {
    const result = S6ConflictOutputSchema.safeParse({
      conflicts: [{ keys: ['a', 'b'], severity: 'medium', reason: 'legacy' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects conflicts with fewer than two attributeIds', () => {
    const result = ConflictSchema.safeParse({
      key: 'eyes',
      message: 'needs two attribute ids',
      attributeIds: ['only-one'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty message', () => {
    const result = ConflictSchema.safeParse({
      key: 'eyes',
      message: '',
      attributeIds: ['a', 'b'],
    })
    expect(result.success).toBe(false)
  })
})
