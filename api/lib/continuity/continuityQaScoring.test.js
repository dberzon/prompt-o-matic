import { describe, expect, it } from 'vitest'
import {
  buildContinuityQaScoringSheet,
  CONTINUITY_QA_ACCEPTANCE_THRESHOLD,
} from './continuityQaHarness.js'
import {
  decideContinuityQaAcceptance,
  validateBlindSeedScoringSheet,
} from './continuityQaScoring.js'

function filledScoringSheet(scoresByScene) {
  const sheet = buildContinuityQaScoringSheet()
  sheet.scenes = sheet.scenes.map((scene, index) => ({
    ...scene,
    scores: scoresByScene[index],
    seedHidden: true,
  }))
  return sheet
}

describe('continuity QA blind-seed scoring', () => {
  it('accepts when each axis averages at or above the threshold', () => {
    const sheet = filledScoringSheet([
      { face: 4, body: 4, wardrobe: 4 },
      { face: 5, body: 4, wardrobe: 4 },
      { face: 4, body: 5, wardrobe: 4 },
      { face: 4, body: 4, wardrobe: 5 },
      { face: 5, body: 4, wardrobe: 4 },
    ])
    const result = decideContinuityQaAcceptance(sheet)
    expect(result.accepted).toBe(true)
    expect(result.outcome).toBe('accepted')
    expect(result.recommendations).toHaveLength(0)
  })

  it('fails and recommends LoRA escalation when an axis is below threshold', () => {
    const sheet = filledScoringSheet([
      { face: 3, body: 4, wardrobe: 4 },
      { face: 3, body: 4, wardrobe: 4 },
      { face: 3, body: 4, wardrobe: 4 },
      { face: 3, body: 4, wardrobe: 4 },
      { face: 3, body: 4, wardrobe: 4 },
    ])
    const result = decideContinuityQaAcceptance(sheet)
    expect(result.accepted).toBe(false)
    expect(result.outcome).toBe('failed')
    expect(result.averages.face).toBeLessThan(CONTINUITY_QA_ACCEPTANCE_THRESHOLD)
    expect(result.recommendations[0].axis).toBe('face')
    expect(result.recommendations[0].recommendation).toMatch(/LoRA/i)
  })

  it('rejects scoring sheets that expose the seed', () => {
    const sheet = filledScoringSheet([
      { face: 5, body: 5, wardrobe: 5 },
      { face: 5, body: 5, wardrobe: 5 },
      { face: 5, body: 5, wardrobe: 5 },
      { face: 5, body: 5, wardrobe: 5 },
      { face: 5, body: 5, wardrobe: 5 },
    ])
    sheet.scenes[0].seedHidden = false
    expect(() => validateBlindSeedScoringSheet(sheet)).toThrow(/seedHidden/i)
  })
})
