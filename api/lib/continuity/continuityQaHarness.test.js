import { describe, expect, it } from 'vitest'
import {
  CONTINUITY_QA_SCENES,
  buildContinuityQaScoringSheet,
  evaluateContinuityQaScores,
} from './continuityQaHarness.js'

describe('continuity QA harness', () => {
  it('defines five environment scenes with varied lighting, composition, and time of day', () => {
    expect(CONTINUITY_QA_SCENES).toHaveLength(5)
    for (const scene of CONTINUITY_QA_SCENES) {
      expect(scene.lighting).toBeTruthy()
      expect(scene.composition).toBeTruthy()
      expect(scene.timeOfDay).toBeTruthy()
    }
  })

  it('builds a blind-seed scoring sheet template', () => {
    const sheet = buildContinuityQaScoringSheet()
    expect(sheet.scenes).toHaveLength(5)
    expect(sheet.scenes[0].seedHidden).toBe(true)
    expect(sheet.scenes[0].scores).toEqual({ face: null, body: null, wardrobe: null })
  })

  it('accepts scores when each axis averages at or above the threshold', () => {
    const result = evaluateContinuityQaScores({
      face: [4, 5, 4, 4, 5],
      body: [4, 4, 4, 5, 4],
      wardrobe: [4, 4, 5, 4, 4],
    })
    expect(result.accepted).toBe(true)
    expect(result.averages.face).toBeGreaterThanOrEqual(4)
  })
})
