import { describe, expect, it } from 'vitest'
import { LocationBibleSchema, parseLocationBible } from './locationBible.schema.js'

const sovietApartmentFixture = {
  identity: {
    name: 'Soviet apartment block',
    eraOrPeriod: '1989',
    summary: 'Brutalist panel housing; courtyard-facing unit used for domestic pressure scenes.',
  },
  geography: {
    placement: 'Moscow periphery, courtyard with playground debris and chained bikes.',
    architecturalNotes: 'Prefabricated panels, small kitchen, narrow balcony.',
  },
  function: {
    purposeInStory: 'Ground domestic conflict; site of the warning visit before the second act turn.',
  },
  visuals: {
    shotPriority: 'Establishing wide on courtyard, then claustrophobic handheld interiors.',
    moodKeywords: ['concrete grey', 'flicker tube light'],
  },
  inhabitants: [],
}

describe('LocationBibleSchema', () => {
  it('parses a typical filming-location fixture', () => {
    const parsed = parseLocationBible(sovietApartmentFixture)
    expect(parsed.identity.name).toBe('Soviet apartment block')
    expect(parsed.identity.eraOrPeriod).toBe('1989')
    expect(parsed.inhabitants).toEqual([])
  })

  it('rejects when identity is missing', () => {
    const { identity: _drop, ...rest } = sovietApartmentFixture
    const result = LocationBibleSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('accepts when recommended weather is omitted', () => {
    const result = LocationBibleSchema.safeParse(sovietApartmentFixture)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.weather).toBeUndefined()
    }
  })
})
