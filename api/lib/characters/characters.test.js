import { describe, expect, it } from 'vitest'
import { characterToEmbeddingText } from './characterToEmbeddingText.js'
import {
  invalidCharacterGenerationRequests,
  invalidCharacterProfiles,
  validCharacterGenerationRequest,
  validCharacterProfile,
  validCharacterProfileOutside20to28,
  validGeneratedImageRecord,
  validQwenImagePromptPack,
} from './fixtures.js'
import { parseJsonFromLlmText } from './jsonUtils.js'
import {
  parseCharacterProfile,
  parseCharacterGenerationRequest,
  parseGeneratedImageRecord,
  parseQwenImagePromptPack,
} from './schemas.js'

describe('character schemas', () => {
  it('parses valid character profile', () => {
    const parsed = parseCharacterProfile(validCharacterProfile)
    expect(parsed.id).toBe('char_001')
    expect(parsed.age).toBe(24)
  })

  it('rejects invalid character profile', () => {
    expect(() => parseCharacterProfile(invalidCharacterProfiles.missingRequired)).toThrow()
    expect(() => parseCharacterProfile(invalidCharacterProfiles.invalidAge)).toThrow()
    expect(() => parseCharacterProfile(invalidCharacterProfiles.withUnknownKey)).toThrow()
  })

  it('accepts stored character profiles outside generation request age window', () => {
    const parsed = parseCharacterProfile(validCharacterProfileOutside20to28)
    expect(parsed.age).toBe(46)
    expect(parsed.apparentAgeRange).toEqual({ min: 44, max: 50 })
  })

  it('parses valid prompt pack and image record', () => {
    const pack = parseQwenImagePromptPack(validQwenImagePromptPack)
    const image = parseGeneratedImageRecord(validGeneratedImageRecord)

    expect(pack.aspectRatio).toBe('3:4')
    expect(image.viewType).toBe('front_portrait')
  })

  it('validates generation request with 20-28 target range', () => {
    const parsed = parseCharacterGenerationRequest(validCharacterGenerationRequest)
    expect(parsed.ageMin).toBe(20)
    expect(parsed.ageMax).toBe(28)
  })

  it('rejects invalid generation requests', () => {
    expect(() => parseCharacterGenerationRequest(invalidCharacterGenerationRequests.ageRangeInverted)).toThrow()
    expect(() => parseCharacterGenerationRequest(invalidCharacterGenerationRequests.invalidAgeBounds)).toThrow()
    expect(() => parseCharacterGenerationRequest(invalidCharacterGenerationRequests.missingViews)).toThrow()
  })
})

describe('json utils', () => {
  it('extracts JSON from fenced code block', () => {
    const raw = `Here is your JSON:\n\n\`\`\`json\n{"id":"char_101","age":24}\n\`\`\``
    const parsed = parseJsonFromLlmText(raw)
    expect(parsed).toEqual({ id: 'char_101', age: 24 })
  })

  it('extracts and repairs JSON surrounded by text', () => {
    const raw = `I generated this candidate:\n{"id":"char_102","age":25,}\nUse it if useful.`
    const parsed = parseJsonFromLlmText(raw)
    expect(parsed).toEqual({ id: 'char_102', age: 25 })
  })
})

describe('characterToEmbeddingText', () => {
  it('serializes fields in stable order', () => {
    const first = characterToEmbeddingText(validCharacterProfile)
    const second = characterToEmbeddingText(validCharacterProfile)

    expect(first).toBe(second)
    expect(first).toContain('Age: 24')
    expect(first).toContain('Apparent age range: 23-26')
    expect(first).toContain('Visual keywords: natural skin, non-idealized, street-casting realism')
  })
})
