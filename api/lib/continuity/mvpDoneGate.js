import { getEntity, listAttributes, listEntities, listVisualAnchors } from '../db/repositories.js'
import { decideContinuityQaAcceptance } from './continuityQaScoring.js'
import { CONTINUITY_QA_ACCEPTANCE_THRESHOLD } from './continuityQaHarness.js'
import { runContinuityQaGenerations } from './continuityQaGeneration.js'

export const MVP_DONE_GATE_MIN_CANON_ATTRIBUTES = 12

export function assessMvpDoneGateReadiness(db, entityId) {
  const entity = getEntity(db, entityId)
  const checks = [
    {
      id: 'character',
      label: 'Character entity',
      met: entity?.type === 'character',
    },
    {
      id: 'environment',
      label: 'At least one environment entity',
      met: listEntities(db, { type: 'environment' }).length >= 1,
      detail: listEntities(db, { type: 'environment' }).length,
    },
    {
      id: 'primary_anchor',
      label: 'Primary reference anchor',
      met: listVisualAnchors(db, { entityId, type: 'reference_image' }).some((anchor) => anchor.isPrimary),
    },
    {
      id: 'visual_descriptor',
      label: 'Stage 5 visual descriptor',
      met: listAttributes(db, { entityId, key: 'visual.descriptor' }).length > 0,
    },
    {
      id: 'canon_attributes',
      label: 'Canon attributes on character',
      met: listAttributes(db, { entityId, provenance: 'canon' }).length >= MVP_DONE_GATE_MIN_CANON_ATTRIBUTES,
      detail: listAttributes(db, { entityId, provenance: 'canon' }).length,
    },
  ]

  return {
    entityId,
    subject: entity?.name || entityId,
    ready: checks.every((check) => check.met),
    checks,
    acceptanceThreshold: CONTINUITY_QA_ACCEPTANCE_THRESHOLD,
    axes: ['face', 'body', 'wardrobe'],
    sceneCount: 5,
  }
}

export async function runMvpDoneGateContinuityQa({
  db,
  entityId,
  comfyService,
  input = {},
  sleep,
}) {
  const readiness = assessMvpDoneGateReadiness(db, entityId)
  if (!readiness.ready) {
    const err = new Error('MVP Done gate prerequisites are not met')
    err.status = 422
    err.details = readiness
    throw err
  }

  const environments = listEntities(db, { type: 'environment' })
  const scopeEntityIds = environments[0]?.id ? [environments[0].id] : []
  return runContinuityQaGenerations({
    db,
    entityId,
    comfyService,
    input: {
      ...input,
      compile: {
        ...(input.compile || {}),
        scopeEntityIds: input.compile?.scopeEntityIds || scopeEntityIds,
      },
    },
    sleep,
  })
}

export function evaluateMvpDoneGate(scoringSheet) {
  return decideContinuityQaAcceptance(scoringSheet)
}
