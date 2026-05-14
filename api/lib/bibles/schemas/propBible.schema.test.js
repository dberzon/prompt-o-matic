import { describe, expect, it } from 'vitest'
import { PropBibleSchema, parsePropBible } from './propBible.schema.js'
import { readSectionRequirement } from './_sectionMarkers.js'

const leatherJacketFixture = {
  identity: { label: 'leather jacket' },
  function: {
    purposeInStory: 'Motorcycle-alley scenes; visual shorthand for rebellion and risk.',
  },
  visuals: {
    continuityNotes: 'Scuffed right elbow, brass zipper, 1970s cut; matte black.',
    keywords: ['leather', 'zipper', 'scuffed'],
  },
  origin: { notes: 'Thrifted in East Berlin stand-in market.', acquiredHow: 'purchase' },
  wearPattern: 'Heavy creasing at shoulders; rain sheen in night exteriors.',
  narrativeRole: 'Gift from older brother; appears in act-one and act-three confrontations.',
}

describe('PropBibleSchema', () => {
  it('parses the leather jacket synthetic fixture', () => {
    const parsed = parsePropBible(leatherJacketFixture)
    expect(parsed.identity.label).toBe('leather jacket')
    expect(parsed.function.purposeInStory).toContain('Motorcycle')
    expect(parsed.visuals.keywords).toContain('leather')
  })

  it('exposes section requirement markers via schema metadata', () => {
    const { shape } = PropBibleSchema
    expect(readSectionRequirement(shape.identity)).toBe('required')
    expect(readSectionRequirement(shape.function)).toBe('required')
    expect(readSectionRequirement(shape.visuals)).toBe('required')
    expect(readSectionRequirement(shape.origin)).toBe('recommended')
    expect(readSectionRequirement(shape.wearPattern)).toBe('recommended')
    expect(readSectionRequirement(shape.narrativeRole)).toBe('recommended')
  })

  it('rejects when required function is missing', () => {
    const { function: _f, ...rest } = leatherJacketFixture
    const result = PropBibleSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('accepts when recommended origin is omitted', () => {
    const { origin: _o, wearPattern: _w, narrativeRole: _n, ...minimal } = leatherJacketFixture
    const result = PropBibleSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.origin).toBeUndefined()
    }
  })
})
