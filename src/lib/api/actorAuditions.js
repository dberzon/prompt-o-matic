import { apiGet, apiPut } from './http.js'

/**
 * GET /api/actor-auditions?bankEntryId=...
 */
export function listActorAuditions(filters = {}) {
  return apiGet('/api/actor-auditions', filters)
}

/**
 * GET /api/actor-auditions?id=<id>
 */
export function getActorAudition(id) {
  return apiGet('/api/actor-auditions', { id })
}

/**
 * PUT /api/actor-auditions
 * Body: { id, ...patch }
 */
export function updateActorAudition(id, patch) {
  return apiPut('/api/actor-auditions', { id, ...patch })
}

/**
 * Approve helper: marks audition as approved.
 */
export function approveActorAudition(id, notes) {
  return updateActorAudition(id, { status: 'approved', notes: notes || undefined })
}

/**
 * Reject helper: marks audition as rejected with optional reason.
 */
export function rejectActorAudition(id, rejectedReason) {
  return updateActorAudition(id, {
    status: 'rejected',
    rejectedReason: rejectedReason || undefined,
  })
}
