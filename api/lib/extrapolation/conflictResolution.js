import {
  dismissSuggested,
  getAttribute,
  supersedeAttributeBy,
} from '../db/repositories.js'

function parseConflictMarker(attribute) {
  if (!attribute?.key?.startsWith('conflict.')) {
    const err = new Error('Attribute is not a conflict marker')
    err.status = 400
    throw err
  }
  if (attribute.provenance !== 'suggested') {
    const err = new Error('Conflict marker must use suggested provenance')
    err.status = 400
    throw err
  }
  const payload = typeof attribute.value === 'string'
    ? JSON.parse(attribute.value)
    : (attribute.value || {})
  const attributeIds = Array.isArray(payload?.attributeIds) ? payload.attributeIds : []
  return {
    message: payload?.message || '',
    attributeIds,
  }
}

export function resolveEntityConflict(db, entityId, conflictId, { winningAttributeId }) {
  if (!winningAttributeId) {
    const err = new Error('Missing winningAttributeId')
    err.status = 400
    throw err
  }

  const conflict = getAttribute(db, conflictId)
  if (!conflict || conflict.entityId !== entityId) {
    const err = new Error('Conflict not found')
    err.status = 404
    throw err
  }

  const { attributeIds } = parseConflictMarker(conflict)
  if (!attributeIds.includes(winningAttributeId)) {
    const err = new Error('winningAttributeId is not part of this conflict')
    err.status = 400
    throw err
  }

  const winner = getAttribute(db, winningAttributeId)
  if (!winner || winner.entityId !== entityId) {
    const err = new Error('Winning attribute not found')
    err.status = 404
    throw err
  }

  const superseded = []
  for (const attributeId of attributeIds) {
    if (attributeId === winningAttributeId) continue
    const existing = getAttribute(db, attributeId)
    if (!existing || existing.entityId !== entityId || existing.supersededBy) continue
    superseded.push(supersedeAttributeBy(db, attributeId, winningAttributeId))
  }

  dismissSuggested(db, conflictId)
  return {
    ok: true,
    conflictId,
    winningAttributeId,
    winner,
    superseded,
    conflict: getAttribute(db, conflictId),
  }
}

export function dismissEntityConflict(db, entityId, conflictId) {
  const conflict = getAttribute(db, conflictId)
  if (!conflict || conflict.entityId !== entityId) {
    const err = new Error('Conflict not found')
    err.status = 404
    throw err
  }
  parseConflictMarker(conflict)
  const dismissed = dismissSuggested(db, conflictId)
  if (!dismissed) {
    const err = new Error('Conflict not found')
    err.status = 404
    throw err
  }
  return {
    ok: true,
    conflictId,
    conflict: getAttribute(db, conflictId),
  }
}
