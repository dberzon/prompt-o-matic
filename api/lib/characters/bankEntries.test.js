import { describe, expect, it } from 'vitest'
import { parseCharacterBankEntry } from './schemas.js'

const validEntry = {
  id: 'bank_001',
  slug: 'lena_sholk',
  name: 'Lena Sholk',
  description: 'A fast strategic thinker with a calm presence.',
  optimizedDescription: 'optimized',
  createdAt: '2026-04-28T12:00:00.000Z',
  updatedAt: '2026-04-28T12:00:00.000Z',
}

describe('CharacterBankEntrySchema', () => {
  it('accepts well-formed entry with all required fields', () => {
    const parsed = parseCharacterBankEntry(validEntry)
    expect(parsed).toEqual(validEntry)
  })

  it('accepts entry without optimizedDescription', () => {
    const { optimizedDescription: _ignored, ...input } = validEntry
    const parsed = parseCharacterBankEntry(input)
    expect(parsed.optimizedDescription).toBeUndefined()
  })

  it('rejects missing id', () => {
    const { id: _ignored, ...input } = validEntry
    expect(() => parseCharacterBankEntry(input)).toThrow()
  })

  it('rejects missing slug', () => {
    const { slug: _ignored, ...input } = validEntry
    expect(() => parseCharacterBankEntry(input)).toThrow()
  })

  it('rejects missing name', () => {
    const { name: _ignored, ...input } = validEntry
    expect(() => parseCharacterBankEntry(input)).toThrow()
  })

  it('rejects missing description', () => {
    const { description: _ignored, ...input } = validEntry
    expect(() => parseCharacterBankEntry(input)).toThrow()
  })

  it('rejects non-snake-case slug variants', () => {
    const invalidSlugs = ['lena-sholk', 'Lena_Sholk', 'lena__sholk', '_lena', 'lena_']
    for (const slug of invalidSlugs) {
      expect(() => parseCharacterBankEntry({ ...validEntry, slug })).toThrow()
    }
  })

  it('rejects unknown extra fields', () => {
    expect(() => parseCharacterBankEntry({ ...validEntry, extraField: true })).toThrow()
  })

  it('rejects non-ISO datetime in createdAt', () => {
    expect(() => parseCharacterBankEntry({ ...validEntry, createdAt: '2026/04/28 12:00:00' })).toThrow()
  })
})
