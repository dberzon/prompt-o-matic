import { describe, expect, it } from 'vitest'
import { RUSLAN_SOURCE_TEXT } from '../../extrapolation/fixtures/ruslanWorkedExample.js'
import { CharacterBibleSchema, parseCharacterBible } from './characterBible.schema.js'
import { readSectionRequirement } from './_sectionMarkers.js'

/** Complete bible aligned with Ruslan MVP acceptance / Section 13 worked-example attributes. */
const ruslanCharacterBibleFixture = {
  demographics: {
    gender: 'male',
    ageRange: '20-25',
    eraLabel: 'Perestroika',
    housingNotes: 'Communal apartment on the outskirts of Moscow; lives with mother and disabled sister.',
  },
  physical: {
    height: 'short',
    build: 'heavy-built, wide shoulders, slight belly',
    face: 'rounded childish face',
    eyes: 'piggy eyes',
    nose: 'short upturned nose',
    lips: 'thin lips',
    skin: 'freckles',
  },
  wardrobe: {
    everyday: 'Student wear; worn student jacket',
    accessories: ['Belomorkanal cigarettes'],
  },
  voice: {
    dialogueDeliveryNotes: 'Dry with friends during smoke breaks.',
    accentOrDiction: 'Moscow outskirts vernacular (light).',
  },
  psychology: {
    temperament: 'wry and loyal',
    motivations: 'Studies mechanical engineering; in love with Rita Vlasova from pedagogical college.',
  },
  history: {
    biographySummary: RUSLAN_SOURCE_TEXT,
    educationOrWork: 'Mechanical engineering student at technical college.',
    habits: 'Smokes with friends during breaks; drinks in Soviet beer halls on Fridays.',
  },
  relationships: [
    { slug: 'rita_vlasova', label: 'Rita Vlasova', nature: 'romantic interest' },
    { slug: 'ruslan_mother', label: 'mother', nature: 'co-habiting family' },
    { slug: 'ruslan_sister', label: 'disabled sister', nature: 'co-habiting family' },
  ],
  visuals: {
    portraitBrief: 'frontal portrait, neutral expression, plain backdrop, freckled face',
    continuityKeywords: ['freckles', 'piggy eyes', 'short upturned nose'],
  },
}

describe('CharacterBibleSchema', () => {
  it('parses a complete Ruslan-aligned fixture (MVP acceptance data)', () => {
    const parsed = parseCharacterBible(ruslanCharacterBibleFixture)
    expect(parsed.demographics.gender).toBe('male')
    expect(parsed.physical.skin).toBe('freckles')
    expect(parsed.relationships.some((r) => r.slug === 'rita_vlasova')).toBe(true)
    expect(parsed.visuals.portraitBrief).toContain('freckled face')
  })

  it('exposes section requirement markers via schema metadata', () => {
    const { shape } = CharacterBibleSchema
    expect(readSectionRequirement(shape.demographics)).toBe('required')
    expect(readSectionRequirement(shape.physical)).toBe('required')
    expect(readSectionRequirement(shape.visuals)).toBe('required')
    expect(readSectionRequirement(shape.wardrobe)).toBe('recommended')
    expect(readSectionRequirement(shape.voice)).toBe('recommended')
    expect(readSectionRequirement(shape.psychology)).toBe('recommended')
    expect(readSectionRequirement(shape.history)).toBe('recommended')
    expect(readSectionRequirement(shape.relationships)).toBe('recommended')
  })

  it('rejects when required demographics section is missing', () => {
    const { demographics: _d, ...rest } = ruslanCharacterBibleFixture
    const result = CharacterBibleSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('accepts when recommended wardrobe is omitted', () => {
    const { wardrobe: _w, ...rest } = ruslanCharacterBibleFixture
    const result = CharacterBibleSchema.safeParse(rest)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.wardrobe).toBeUndefined()
    }
  })
})
