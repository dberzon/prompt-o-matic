export const CONTINUITY_QA_SUBJECT = 'Ruslan Levashov'

export const CONTINUITY_QA_SCENES = [
  {
    id: 'env-morning-kitchen',
    environment: 'communal apartment kitchen',
    lighting: 'cool morning window light, low contrast',
    composition: 'medium shot, eye level',
    timeOfDay: 'early morning',
  },
  {
    id: 'env-noon-courtyard',
    environment: 'Soviet courtyard between panel blocks',
    lighting: 'hard overhead noon sun, short shadows',
    composition: 'wide shot, slight low angle',
    timeOfDay: 'midday',
  },
  {
    id: 'env-dusk-beer-hall',
    environment: 'Soviet beer hall interior',
    lighting: 'warm practical lamps, smoky atmosphere',
    composition: 'three-quarter medium shot',
    timeOfDay: 'dusk',
  },
  {
    id: 'env-night-bus-stop',
    environment: 'outskirts bus stop in light snow',
    lighting: 'sodium streetlight with blue fill',
    composition: 'profile medium-long shot',
    timeOfDay: 'night',
  },
  {
    id: 'env-overcast-college',
    environment: 'technical college corridor',
    lighting: 'flat overcast daylight through frosted windows',
    composition: 'centered frontal medium shot',
    timeOfDay: 'late afternoon overcast',
  },
]

export const CONTINUITY_QA_AXES = ['face', 'body', 'wardrobe']

export const CONTINUITY_QA_ACCEPTANCE_THRESHOLD = 4

export function buildContinuityQaScoringSheet({ subject = CONTINUITY_QA_SUBJECT, scenes = CONTINUITY_QA_SCENES } = {}) {
  return {
    subject,
    axes: CONTINUITY_QA_AXES,
    acceptanceThreshold: CONTINUITY_QA_ACCEPTANCE_THRESHOLD,
    scenes: scenes.map((scene) => ({
      ...scene,
      scores: Object.fromEntries(CONTINUITY_QA_AXES.map((axis) => [axis, null])),
      reviewerNotes: '',
      seedHidden: true,
    })),
  }
}

export function evaluateContinuityQaScores(scoresByAxis, threshold = CONTINUITY_QA_ACCEPTANCE_THRESHOLD) {
  const averages = {}
  for (const axis of CONTINUITY_QA_AXES) {
    const values = scoresByAxis[axis] || []
    if (values.length === 0) {
      averages[axis] = 0
      continue
    }
    const total = values.reduce((sum, value) => sum + value, 0)
    averages[axis] = total / values.length
  }
  const accepted = CONTINUITY_QA_AXES.every((axis) => averages[axis] >= threshold)
  return { averages, accepted, threshold }
}
