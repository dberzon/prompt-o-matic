import { describe, expect, it } from 'vitest'
import { EraBibleSchema, parseEraBible } from './eraBible.schema.js'
import { readSectionRequirement } from './_sectionMarkers.js'

/** Synthetic era aligned with issue acceptance (label + span). */
const sovietPerestroikaFixture = {
  identity: { label: 'Soviet Perestroika 1985–1991' },
  timeframe: { spanDescription: '1985–1991' },
  materialCulture: 'Worn denim, bootleg cassettes, kitchen-table repairs; shortage aesthetics.',
  slang: 'Familiar address shifts; kitchen-table irony.',
  socialNorms: 'Queue culture; public vs private speech split.',
  tabuos: 'Direct criticism of the Party line in official settings.',
  visualMotifs: 'Flickering tube light, concrete paneling, chrome samovar.',
}

describe('EraBibleSchema', () => {
  it('parses the Soviet Perestroika synthetic fixture', () => {
    const parsed = parseEraBible(sovietPerestroikaFixture)
    expect(parsed.identity.label).toBe('Soviet Perestroika 1985–1991')
    expect(parsed.timeframe.spanDescription).toBe('1985–1991')
    expect(parsed.materialCulture).toContain('shortage')
  })

  it('exposes section requirement markers via schema metadata', () => {
    const { shape } = EraBibleSchema
    expect(readSectionRequirement(shape.identity)).toBe('required')
    expect(readSectionRequirement(shape.timeframe)).toBe('required')
    expect(readSectionRequirement(shape.materialCulture)).toBe('recommended')
    expect(readSectionRequirement(shape.slang)).toBe('recommended')
    expect(readSectionRequirement(shape.socialNorms)).toBe('recommended')
    expect(readSectionRequirement(shape.tabuos)).toBe('recommended')
    expect(readSectionRequirement(shape.visualMotifs)).toBe('recommended')
  })

  it('rejects when required timeframe is missing', () => {
    const { timeframe: _t, ...rest } = sovietPerestroikaFixture
    const result = EraBibleSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('accepts when recommended materialCulture is omitted', () => {
    const {
      materialCulture: _m,
      slang: _s,
      socialNorms: _so,
      tabuos: _ta,
      visualMotifs: _v,
      ...minimal
    } = sovietPerestroikaFixture
    const result = EraBibleSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.materialCulture).toBeUndefined()
    }
  })
})
