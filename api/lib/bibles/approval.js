import { getEntity, listAttributes, writeAttribute } from '../db/repositories.js'
import { EntityNotFoundError } from './projection.js'
import { CharacterBibleSchema } from './schemas/characterBible.schema.js'
import { EraBibleSchema } from './schemas/eraBible.schema.js'
import { LocationBibleSchema } from './schemas/locationBible.schema.js'
import { PropBibleSchema } from './schemas/propBible.schema.js'

/** @typedef {'approved' | 'rejected' | 'pending'} BibleSectionApprovalState */

/** ISO timestamp used when a section has no approval attribute yet */
export const BIBLE_SECTION_PENDING_TS = '1970-01-01T00:00:00.000Z'

/**
 * @param {string} entityType
 * @returns {Set<string>}
 */
function bibleSectionKeysForEntityType(entityType) {
  switch (entityType) {
    case 'character':
    case 'environment':
    case 'institution':
      return new Set(Object.keys(CharacterBibleSchema.shape))
    case 'location':
      return new Set(Object.keys(LocationBibleSchema.shape))
    case 'era':
      return new Set(Object.keys(EraBibleSchema.shape))
    case 'prop':
      return new Set(Object.keys(PropBibleSchema.shape))
    default:
      throw new Error(`bibleSectionApproval: unsupported entity type: ${entityType}`)
  }
}

/**
 * @param {string} section
 * @param {string} entityType
 */
function assertKnownBibleSection(section, entityType) {
  if (!section || typeof section !== 'string') {
    throw new Error('bibleSectionApproval: section must be a non-empty string')
  }
  const allowed = bibleSectionKeysForEntityType(entityType)
  if (!allowed.has(section)) {
    throw new Error(`bibleSectionApproval: unknown Bible section "${section}" for entity type ${entityType}`)
  }
}

/**
 * @param {string} section
 * @returns {string}
 */
function approvalAttributeKey(section) {
  return `_approval.${section}`
}

/**
 * @param {unknown} actor
 * @returns {string}
 */
function requireActor(actor) {
  if (!actor || typeof actor !== 'string' || !actor.trim()) {
    throw new Error('bibleSectionApproval: actor is required')
  }
  return actor.trim()
}

/**
 * @param {unknown} value
 * @returns {{ state: 'approved' | 'rejected'; actor?: string; ts: string; note?: string } | null}
 */
function parseApprovalPayload(value) {
  if (!value || typeof value !== 'object') return null
  const o = /** @type {Record<string, unknown>} */ (value)
  const state = o.state
  if (state !== 'approved' && state !== 'rejected') return null
  const ts = o.ts
  if (typeof ts !== 'string' || !ts) return null
  const actor = o.actor
  const note = o.note
  return {
    state,
    ts,
    ...(typeof actor === 'string' && actor ? { actor } : {}),
    ...(typeof note === 'string' && note ? { note } : {}),
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {string} section
 */
function latestApprovalAttribute(db, entityId, section) {
  const key = approvalAttributeKey(section)
  const rows = listAttributes(db, { entityId, key })
  return rows[0] ?? null
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {string} section
 * @param {{ actor: string; note?: string }} opts
 * @returns {{ ok: true; attributeId: string }}
 */
export function approveBibleSection(db, entityId, section, { actor, note } = {}) {
  const entity = getEntity(db, entityId)
  if (!entity) throw new EntityNotFoundError(entityId)
  assertKnownBibleSection(section, entity.type)
  const trimmedActor = requireActor(actor)

  const current = latestApprovalAttribute(db, entityId, section)
  const parsed = current ? parseApprovalPayload(current.value) : null
  if (parsed?.state === 'approved') {
    return { ok: true, attributeId: current.id }
  }

  const ts = new Date().toISOString()
  /** @type {Record<string, unknown>} */
  const value = { state: 'approved', actor: trimmedActor, ts }
  if (note != null && String(note).trim()) {
    value.note = String(note).trim()
  }

  const row = writeAttribute(db, {
    entityId,
    key: approvalAttributeKey(section),
    value,
    provenance: 'canon',
    supersedes: current?.id,
  })
  return { ok: true, attributeId: row.id }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {string} section
 * @param {{ actor: string; note?: string }} opts
 * @returns {{ ok: true }}
 */
export function rejectBibleSection(db, entityId, section, { actor, note } = {}) {
  const entity = getEntity(db, entityId)
  if (!entity) throw new EntityNotFoundError(entityId)
  assertKnownBibleSection(section, entity.type)
  const trimmedActor = requireActor(actor)

  const ts = new Date().toISOString()
  const current = latestApprovalAttribute(db, entityId, section)
  /** @type {Record<string, unknown>} */
  const value = { state: 'rejected', actor: trimmedActor, ts }
  if (note != null && String(note).trim()) {
    value.note = String(note).trim()
  }

  writeAttribute(db, {
    entityId,
    key: approvalAttributeKey(section),
    value,
    provenance: 'canon',
    supersedes: current?.id,
  })
  return { ok: true }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @returns {Record<string, { state: BibleSectionApprovalState; actor?: string; ts: string }>}
 */
export function getBibleApprovals(db, entityId) {
  const entity = getEntity(db, entityId)
  if (!entity) throw new EntityNotFoundError(entityId)
  const sections = [...bibleSectionKeysForEntityType(entity.type)]
  sections.sort()

  /** @type {Record<string, { state: BibleSectionApprovalState; actor?: string; ts: string }>} */
  const out = {}
  for (const s of sections) {
    const row = latestApprovalAttribute(db, entityId, s)
    const payload = row ? parseApprovalPayload(row.value) : null
    if (!payload) {
      out[s] = { state: 'pending', ts: BIBLE_SECTION_PENDING_TS }
      continue
    }
    if (payload.state === 'approved' || payload.state === 'rejected') {
      /** @type {{ state: 'approved' | 'rejected'; ts: string; actor?: string }} */
      const entry = { state: payload.state, ts: payload.ts }
      if (payload.actor) entry.actor = payload.actor
      out[s] = entry
      continue
    }
    out[s] = { state: 'pending', ts: BIBLE_SECTION_PENDING_TS }
  }
  return out
}
