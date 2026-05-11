import { enqueueReferencePortraitRender } from '../continuity/referencePortraitRender.js'
import { getEntity, listAttributes } from '../db/repositories.js'
import { selectAttributesForReferencePortrait } from '../prompts/entityAttributeProfile.js'

export function resolveStage5VisualDescriptor(attributes) {
  const selected = selectAttributesForReferencePortrait(attributes)
  return selected.get('visual.descriptor') || null
}

export async function triggerStage5ReferenceImageGeneration({
  db,
  entityId,
  comfyService,
  input = {},
  fetchImpl,
  sleep,
}) {
  const entity = getEntity(db, entityId)
  if (!entity) {
    const err = new Error('Entity not found')
    err.status = 404
    throw err
  }

  const descriptorAttr = resolveStage5VisualDescriptor(listAttributes(db, { entityId }))
  if (!descriptorAttr) {
    const err = new Error('Missing visual.descriptor attribute')
    err.status = 422
    throw err
  }
  if (descriptorAttr.sourceStage != null && descriptorAttr.sourceStage !== 5) {
    const err = new Error('visual.descriptor must be produced by stage 5 before reference generation')
    err.status = 422
    throw err
  }

  const result = await enqueueReferencePortraitRender({
    db,
    entityId,
    comfyService,
    input,
    fetchImpl,
    sleep,
  })

  return {
    ...result,
    stage: 5,
    feature: 'F_CONT_REFGEN',
    visualDescriptor: descriptorAttr.value,
  }
}
