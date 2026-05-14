import { getBibleCompleteness } from '../bibles/completeness.js'
import { getEntity, listAttributes, listEntities, listVisualAnchors } from '../db/repositories.js'
import { decideContinuityQaAcceptance } from './continuityQaScoring.js'
import { CONTINUITY_QA_ACCEPTANCE_THRESHOLD } from './continuityQaHarness.js'
import { runContinuityQaGenerations } from './continuityQaGeneration.js'

/** Legacy gate: minimum flat canon rows (used only when `QPB_MVP_GATE_USE_COMPLETENESS=0`). */
export const MVP_DONE_GATE_MIN_CANON_ATTRIBUTES = 12

/** Default Bible completeness ratio for the MVP Done gate (character entities). */
export const MVP_DONE_GATE_MIN_COMPLETENESS_RATIO = 0.75

function readMinCompletenessRatio() {
  const raw = process.env.QPB_MVP_GATE_MIN_COMPLETENESS_RATIO
  if (raw === undefined || raw === '') return MVP_DONE_GATE_MIN_COMPLETENESS_RATIO
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : MVP_DONE_GATE_MIN_COMPLETENESS_RATIO
}

function useCompletenessGate() {
  const v = process.env.QPB_MVP_GATE_USE_COMPLETENESS
  return v !== '0' && v !== 'false' && v !== 'off'
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string | null | undefined} entityId
 * @param {{ type?: string } | null} entity
 */
function buildBibleOrCanonGateCheck(db, entityId, entity) {
  if (!useCompletenessGate()) {
    const canonCount = listAttributes(db, { entityId, provenance: 'canon' }).length
    return {
      id: 'canon_attributes',
      label: 'Canon attributes on character',
      met: canonCount >= MVP_DONE_GATE_MIN_CANON_ATTRIBUTES,
      detail: canonCount,
    }
  }

  const minRatio = readMinCompletenessRatio()
  if (entity?.type !== 'character') {
    return {
      id: 'bible_completeness',
      label: 'Character Bible completeness',
      met: false,
      detail: 'not a character entity',
      missingRequiredFields: [],
    }
  }

  const completeness = getBibleCompleteness(db, entityId)
  const ratioOk = completeness.ratio >= minRatio
  const missingReq = completeness.missingRequired.map((r) => `${r.section}.${r.field}`)
  const missingRec = completeness.missingRecommended.map((r) => `${r.section}.${r.field}`)

  let detail
  if (ratioOk) {
    detail = `ratio ${completeness.ratio.toFixed(3)} (≥${minRatio})`
  } else {
    const parts = [`ratio ${completeness.ratio.toFixed(3)} (need ≥${minRatio})`]
    if (missingReq.length) {
      parts.push(`missing required: ${missingReq.join(', ')}`)
    } else if (missingRec.length) {
      const head = missingRec.slice(0, 12).join(', ')
      parts.push(`missing recommended (raise weighted coverage): ${head}${missingRec.length > 12 ? '…' : ''}`)
    }
    detail = parts.join('; ')
  }

  return {
    id: 'bible_completeness',
    label: 'Character Bible completeness',
    met: ratioOk,
    detail,
    missingRequiredFields: missingReq,
    completenessRatio: completeness.ratio,
  }
}

function formatPrerequisiteErrorMessage(readiness) {
  const failed = readiness.checks.filter((c) => !c.met)
  const bibleFail = failed.find((c) => c.id === 'bible_completeness' || c.id === 'canon_attributes')
  if (bibleFail?.id === 'bible_completeness' && typeof bibleFail.detail === 'string') {
    return `MVP Done gate prerequisites are not met (${bibleFail.detail})`
  }
  if (bibleFail?.id === 'canon_attributes') {
    return `MVP Done gate prerequisites are not met (canon attribute count ${bibleFail.detail}; need ≥${MVP_DONE_GATE_MIN_CANON_ATTRIBUTES})`
  }
  return 'MVP Done gate prerequisites are not met'
}

export function assessMvpDoneGateReadiness(db, entityId) {
  const entity = getEntity(db, entityId)
  const bibleGate = buildBibleOrCanonGateCheck(db, entityId, entity)
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
    bibleGate,
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
    const err = new Error(formatPrerequisiteErrorMessage(readiness))
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
