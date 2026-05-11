import {
  CONTINUITY_QA_AXES,
  CONTINUITY_QA_ACCEPTANCE_THRESHOLD,
  CONTINUITY_QA_SCENES,
  buildContinuityQaScoringSheet,
  evaluateContinuityQaScores,
} from './continuityQaHarness.js'

const LORA_ESCALATION_RECOMMENDATION = 'Escalate to per-character LoRA training (Section 7 option b), refresh the primary reference anchor, and rerun the five-scene continuity harness before the next acceptance review.'

function isValidScore(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5
}

export function scoresByAxisFromSheet(scoringSheet) {
  const scoresByAxis = Object.fromEntries(CONTINUITY_QA_AXES.map((axis) => [axis, []]))
  for (const scene of scoringSheet?.scenes || []) {
    for (const axis of CONTINUITY_QA_AXES) {
      const value = scene?.scores?.[axis]
      if (typeof value === 'number') {
        scoresByAxis[axis].push(value)
      }
    }
  }
  return scoresByAxis
}

export function validateBlindSeedScoringSheet(scoringSheet) {
  const scenes = Array.isArray(scoringSheet?.scenes) ? scoringSheet.scenes : []
  if (scenes.length !== CONTINUITY_QA_SCENES.length) {
    const err = new Error(`Scoring sheet must include ${CONTINUITY_QA_SCENES.length} scenes`)
    err.status = 400
    throw err
  }

  for (const scene of scenes) {
    if (scene?.seedHidden === false) {
      const err = new Error('Blind-seed scoring requires seedHidden=true on every scene')
      err.status = 400
      throw err
    }
    for (const axis of CONTINUITY_QA_AXES) {
      const value = scene?.scores?.[axis]
      if (!isValidScore(value)) {
        const err = new Error(`Scene ${scene?.id || 'unknown'} is missing a valid ${axis} score (1-5)`)
        err.status = 400
        throw err
      }
    }
  }
}

export function buildContinuityQaFailureRecommendations(evaluation) {
  if (evaluation.accepted) return []
  return CONTINUITY_QA_AXES
    .filter((axis) => evaluation.averages[axis] < evaluation.threshold)
    .map((axis) => ({
      axis,
      average: evaluation.averages[axis],
      recommendation: LORA_ESCALATION_RECOMMENDATION,
    }))
}

export function decideContinuityQaAcceptance(scoringSheet, threshold = CONTINUITY_QA_ACCEPTANCE_THRESHOLD) {
  validateBlindSeedScoringSheet(scoringSheet)
  const scoresByAxis = scoresByAxisFromSheet(scoringSheet)
  const evaluation = evaluateContinuityQaScores(scoresByAxis, threshold)
  const recommendations = buildContinuityQaFailureRecommendations(evaluation)
  return {
    ...evaluation,
    outcome: evaluation.accepted ? 'accepted' : 'failed',
    recommendations,
    scoringSheet: {
      subject: scoringSheet?.subject || null,
      sceneCount: scoringSheet.scenes.length,
    },
  }
}

export function createContinuityQaScoringTemplate({ entityId, subject } = {}) {
  return {
    entityId: entityId || null,
    ...buildContinuityQaScoringSheet({ subject }),
  }
}
