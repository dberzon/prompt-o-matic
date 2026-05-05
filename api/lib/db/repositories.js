import { randomUUID } from 'node:crypto'
import {
  parseActorAudition,
  parseActorCandidate,
  parseCharacterBankEntry,
  parseCharacterProfile,
  parseGeneratedImageRecord,
  parseQwenImagePromptPack,
} from '../characters/schemas.js'

function nowIso() {
  return new Date().toISOString()
}

function rowToPayload(row) {
  if (!row) return null
  return JSON.parse(row.payload_json)
}

function validateCharacterOrThrow(input) {
  return parseCharacterProfile(input)
}

function validatePromptPackOrThrow(input) {
  return parseQwenImagePromptPack(input)
}

function validateGeneratedImageOrThrow(input) {
  return parseGeneratedImageRecord(input)
}

export function createCharacter(db, profile) {
  const createdAt = profile.createdAt || nowIso()
  const payload = validateCharacterOrThrow({ ...profile, createdAt, updatedAt: profile.updatedAt || createdAt })
  const updatedAt = payload.updatedAt || createdAt
  const embeddingStatus = payload.embeddingStatus || 'not_indexed'
  const lifecycleStatus = payload.lifecycleStatus || 'auditioned'
  const id = payload.id || randomUUID()
  const record = { ...payload, id, createdAt, updatedAt, embeddingStatus, lifecycleStatus }

  db.prepare(`
    INSERT INTO characters (id, project_id, embedding_status, lifecycle_status, payload_json, created_at, updated_at)
    VALUES (@id, @project_id, @embedding_status, @lifecycle_status, @payload_json, @created_at, @updated_at)
  `).run({
    id: record.id,
    project_id: record.projectId ?? null,
    embedding_status: record.embeddingStatus,
    lifecycle_status: record.lifecycleStatus,
    payload_json: JSON.stringify(record),
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  })
  return record
}

export function getCharacter(db, id) {
  const row = db.prepare('SELECT payload_json FROM characters WHERE id = ?').get(id)
  return rowToPayload(row)
}

export function countCharacters(db) {
  const row = db.prepare('SELECT COUNT(*) as total FROM characters').get()
  return Number(row?.total || 0)
}

export function countCharactersByEmbeddingStatus(db) {
  const rows = db.prepare(`
    SELECT embedding_status, COUNT(*) as total
    FROM characters
    GROUP BY embedding_status
  `).all()

  const base = {
    not_indexed: 0,
    pending: 0,
    embedded: 0,
    failed: 0,
  }

  for (const row of rows) {
    if (row?.embedding_status in base) {
      base[row.embedding_status] = Number(row.total || 0)
    }
  }
  return base
}

export function listCharacters(db, filters = {}) {
  const clauses = []
  const values = []
  if (filters.projectId) {
    clauses.push('project_id = ?')
    values.push(filters.projectId)
  }
  if (filters.embeddingStatus) {
    clauses.push('embedding_status = ?')
    values.push(filters.embeddingStatus)
  }
  if (filters.includeArchived === 'only') {
    clauses.push('archived_at IS NOT NULL')
  } else if (!filters.includeArchived) {
    clauses.push('(archived_at IS NULL)')
  }
  if (filters.lifecycleStatus) {
    const statuses = Array.isArray(filters.lifecycleStatus) ? filters.lifecycleStatus : [filters.lifecycleStatus]
    clauses.push(`lifecycle_status IN (${statuses.map(() => '?').join(',')})`)
    values.push(...statuses)
  }
  if (filters.excludeLifecycleStatus) {
    const statuses = Array.isArray(filters.excludeLifecycleStatus) ? filters.excludeLifecycleStatus : [filters.excludeLifecycleStatus]
    clauses.push(`lifecycle_status NOT IN (${statuses.map(() => '?').join(',')})`)
    values.push(...statuses)
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const limit = Number.isInteger(filters.limit) ? filters.limit : null
  const limitSql = limit && limit > 0 ? 'LIMIT ?' : ''
  if (limitSql) values.push(limit)

  const orderBy = filters.sortBy === 'last_rendered_at'
    ? 'COALESCE(last_rendered_at, created_at) DESC'
    : 'created_at DESC'
  const rows = db.prepare(`
    SELECT payload_json, archived_at
    FROM characters
    ${whereSql}
    ORDER BY ${orderBy}
    ${limitSql}
  `).all(...values)

  let items = rows.map((row) => ({ ...rowToPayload(row), archived_at: row.archived_at ?? null }))

  if (filters.gender) {
    const g = filters.gender.toLowerCase()
    items = items.filter((c) => (c?.genderPresentation ?? '').toLowerCase().includes(g))
  }
  if (Number.isFinite(filters.ageMin)) {
    items = items.filter((c) => typeof c?.age === 'number' && c.age >= filters.ageMin)
  }
  if (Number.isFinite(filters.ageMax)) {
    items = items.filter((c) => typeof c?.age === 'number' && c.age <= filters.ageMax)
  }
  if (filters.search) {
    const q = filters.search.toLowerCase()
    items = items.filter((c) => {
      const name = (c?.name ?? '').toLowerCase()
      const archetype = (c?.cinematicArchetype ?? '').toLowerCase()
      return name.includes(q) || archetype.includes(q)
    })
  }

  return items
}

export function updateCharacter(db, id, patch) {
  const current = getCharacter(db, id)
  if (!current) return null
  const merged = {
    ...current,
    ...patch,
    id,
    updatedAt: nowIso(),
  }
  const record = validateCharacterOrThrow(merged)
  db.prepare(`
    UPDATE characters
    SET project_id = @project_id,
        embedding_status = @embedding_status,
        lifecycle_status = @lifecycle_status,
        last_rendered_at = @last_rendered_at,
        payload_json = @payload_json,
        updated_at = @updated_at
    WHERE id = @id
  `).run({
    id: record.id,
    project_id: record.projectId ?? null,
    embedding_status: record.embeddingStatus || 'not_indexed',
    lifecycle_status: record.lifecycleStatus || 'auditioned',
    last_rendered_at: record.lastRenderedAt ?? null,
    payload_json: JSON.stringify(record),
    updated_at: record.updatedAt,
  })
  return record
}

export function deleteCharacter(db, id) {
  const result = db.prepare('DELETE FROM characters WHERE id = ?').run(id)
  return result.changes > 0
}

export function archiveCharacter(db, id) {
  const result = db.prepare('UPDATE characters SET archived_at = ? WHERE id = ?').run(nowIso(), id)
  return result.changes > 0
}

export function restoreCharacter(db, id) {
  const result = db.prepare('UPDATE characters SET archived_at = NULL WHERE id = ?').run(id)
  return result.changes > 0
}

export function createPromptPack(db, pack) {
  const payload = validatePromptPackOrThrow({ ...pack, createdAt: pack.createdAt || nowIso() })
  const id = payload.id || randomUUID()
  const createdAt = payload.createdAt || nowIso()
  const updatedAt = nowIso()
  const record = { ...payload, id, createdAt }

  db.prepare(`
    INSERT INTO prompt_packs (id, character_id, project_id, payload_json, created_at, updated_at)
    VALUES (@id, @character_id, @project_id, @payload_json, @created_at, @updated_at)
  `).run({
    id,
    character_id: payload.characterId,
    project_id: payload.projectId ?? null,
    payload_json: JSON.stringify(record),
    created_at: createdAt,
    updated_at: updatedAt,
  })
  return record
}

export function getPromptPack(db, id) {
  const row = db.prepare('SELECT payload_json FROM prompt_packs WHERE id = ?').get(id)
  return rowToPayload(row)
}

export function listPromptPacks(db, filters = {}) {
  const clauses = []
  const values = []
  if (filters.characterId) {
    clauses.push('character_id = ?')
    values.push(filters.characterId)
  }
  if (filters.projectId) {
    clauses.push('project_id = ?')
    values.push(filters.projectId)
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = db.prepare(`
    SELECT payload_json
    FROM prompt_packs
    ${whereSql}
    ORDER BY created_at DESC
  `).all(...values)
  return rows.map(rowToPayload)
}

export function createGeneratedImageRecord(db, imageRecord) {
  const payload = validateGeneratedImageOrThrow({ ...imageRecord, createdAt: imageRecord.createdAt || nowIso() })
  const id = payload.id || randomUUID()
  const createdAt = payload.createdAt || nowIso()
  const updatedAt = nowIso()
  const record = { ...payload, id, createdAt }

  db.prepare(`
    INSERT INTO generated_images (id, character_id, prompt_pack_id, project_id, payload_json, created_at, updated_at)
    VALUES (@id, @character_id, @prompt_pack_id, @project_id, @payload_json, @created_at, @updated_at)
  `).run({
    id,
    character_id: payload.characterId ?? null,
    prompt_pack_id: payload.promptPackId,
    project_id: payload.projectId ?? null,
    payload_json: JSON.stringify(record),
    created_at: createdAt,
    updated_at: updatedAt,
  })
  return record
}

export function getGeneratedImageRecord(db, id) {
  const row = db.prepare('SELECT payload_json FROM generated_images WHERE id = ?').get(id)
  return rowToPayload(row)
}

export function listGeneratedImageRecords(db, filters = {}) {
  const clauses = []
  const values = []
  if (filters.characterId) {
    clauses.push('character_id = ?')
    values.push(filters.characterId)
  }
  if (filters.promptPackId) {
    clauses.push('prompt_pack_id = ?')
    values.push(filters.promptPackId)
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = db.prepare(`
    SELECT payload_json
    FROM generated_images
    ${whereSql}
    ORDER BY created_at DESC
  `).all(...values).map(rowToPayload)

  let items = rows
  if (filters.viewType) {
    items = items.filter((row) => row?.viewType === filters.viewType)
  }
  if (typeof filters.approved === 'boolean') {
    items = items.filter((row) => row?.approved === filters.approved)
  }
  if (Number.isInteger(filters.limit) && filters.limit > 0) {
    items = items.slice(0, filters.limit)
  }
  return items
}

export function updateGeneratedImageRecord(db, id, patch) {
  const current = getGeneratedImageRecord(db, id)
  if (!current) return null
  const merged = {
    ...current,
    ...patch,
    id,
  }
  const record = validateGeneratedImageOrThrow(merged)
  db.prepare(`
    UPDATE generated_images
    SET character_id = @character_id,
        prompt_pack_id = @prompt_pack_id,
        project_id = @project_id,
        payload_json = @payload_json,
        updated_at = @updated_at
    WHERE id = @id
  `).run({
    id: record.id,
    character_id: record.characterId ?? null,
    prompt_pack_id: record.promptPackId,
    project_id: record.projectId ?? null,
    payload_json: JSON.stringify(record),
    updated_at: nowIso(),
  })
  return getGeneratedImageRecord(db, id)
}

function mapBatchRow(row) {
  if (!row) return null
  return {
    id: row.id,
    request: JSON.parse(row.request_json),
    options: JSON.parse(row.options_json),
    provider: JSON.parse(row.provider_json),
    summary: JSON.parse(row.summary_json),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapBatchCandidateRow(row) {
  if (!row) return null
  return {
    id: row.id,
    batchId: row.batch_id,
    sourceCandidateId: row.source_candidate_id || null,
    candidate: JSON.parse(row.candidate_json),
    classification: row.classification,
    reviewStatus: row.review_status,
    similarity: row.similarity_json ? JSON.parse(row.similarity_json) : null,
    errors: row.errors_json ? JSON.parse(row.errors_json) : null,
    mutation: row.mutation_json ? JSON.parse(row.mutation_json) : null,
    generationRound: Number(row.generation_round || 1),
    savedCharacterId: row.saved_character_id || null,
    reviewNote: row.review_note || null,
    previewImageUrl: row.preview_image_url || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function deriveBatchStatus(db, batchId) {
  const rows = db.prepare(`
    SELECT review_status, COUNT(*) as total
    FROM character_batch_candidates
    WHERE batch_id = ?
    GROUP BY review_status
  `).all(batchId)
  const counts = Object.fromEntries(rows.map((r) => [r.review_status, Number(r.total || 0)]))
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
  if (total === 0) return 'generated'
  const pending = counts.pending || 0
  if (pending === total) return 'generated'
  if (pending > 0) return 'partially_reviewed'
  return 'completed'
}

export function createCharacterBatch(db, payload) {
  const now = nowIso()
  const id = payload.id || randomUUID()
  const record = {
    id,
    request: payload.request || {},
    options: payload.options || {},
    provider: payload.provider || {},
    summary: payload.summary || {},
    status: payload.status || 'generated',
    createdAt: now,
    updatedAt: now,
  }

  db.prepare(`
    INSERT INTO character_batches (id, request_json, options_json, provider_json, summary_json, status, created_at, updated_at)
    VALUES (@id, @request_json, @options_json, @provider_json, @summary_json, @status, @created_at, @updated_at)
  `).run({
    id: record.id,
    request_json: JSON.stringify(record.request),
    options_json: JSON.stringify(record.options),
    provider_json: JSON.stringify(record.provider),
    summary_json: JSON.stringify(record.summary),
    status: record.status,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  })
  return record
}

export function updateCharacterBatch(db, id, patch) {
  const current = getCharacterBatch(db, id)
  if (!current) return null
  const next = {
    ...current,
    ...patch,
    id,
    updatedAt: nowIso(),
  }
  db.prepare(`
    UPDATE character_batches
    SET request_json=@request_json,
        options_json=@options_json,
        provider_json=@provider_json,
        summary_json=@summary_json,
        status=@status,
        updated_at=@updated_at
    WHERE id=@id
  `).run({
    id,
    request_json: JSON.stringify(next.request || {}),
    options_json: JSON.stringify(next.options || {}),
    provider_json: JSON.stringify(next.provider || {}),
    summary_json: JSON.stringify(next.summary || {}),
    status: next.status,
    updated_at: next.updatedAt,
  })
  return getCharacterBatch(db, id)
}

export function getCharacterBatch(db, id) {
  const row = db.prepare(`
    SELECT id, request_json, options_json, provider_json, summary_json, status, created_at, updated_at
    FROM character_batches
    WHERE id = ?
  `).get(id)
  return mapBatchRow(row)
}

export function listCharacterBatches(db, filters = {}) {
  const clauses = []
  const values = []
  if (filters.status) {
    clauses.push('status = ?')
    values.push(filters.status)
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = db.prepare(`
    SELECT id, request_json, options_json, provider_json, summary_json, status, created_at, updated_at
    FROM character_batches
    ${whereSql}
    ORDER BY created_at DESC
  `).all(...values)
  return rows.map(mapBatchRow)
}

export function createBatchCandidate(db, payload) {
  const now = nowIso()
  const id = payload.id || randomUUID()
  db.prepare(`
    INSERT INTO character_batch_candidates
      (id, batch_id, source_candidate_id, candidate_json, classification, review_status, similarity_json, errors_json, mutation_json, generation_round, saved_character_id, review_note, preview_image_url, created_at, updated_at)
    VALUES
      (@id, @batch_id, @source_candidate_id, @candidate_json, @classification, @review_status, @similarity_json, @errors_json, @mutation_json, @generation_round, @saved_character_id, @review_note, @preview_image_url, @created_at, @updated_at)
  `).run({
    id,
    batch_id: payload.batchId,
    source_candidate_id: payload.sourceCandidateId || null,
    candidate_json: JSON.stringify(payload.candidate || {}),
    classification: payload.classification || 'pendingReview',
    review_status: payload.reviewStatus || 'pending',
    similarity_json: payload.similarity ? JSON.stringify(payload.similarity) : null,
    errors_json: payload.errors ? JSON.stringify(payload.errors) : null,
    mutation_json: payload.mutation ? JSON.stringify(payload.mutation) : null,
    generation_round: Number.isInteger(payload.generationRound) ? payload.generationRound : 1,
    saved_character_id: payload.savedCharacterId || null,
    review_note: payload.reviewNote || null,
    preview_image_url: payload.previewImageUrl || null,
    created_at: now,
    updated_at: now,
  })
  return getBatchCandidate(db, id)
}

export function getBatchCandidate(db, id) {
  const row = db.prepare(`
    SELECT id, batch_id, source_candidate_id, candidate_json, classification, review_status, similarity_json, errors_json, mutation_json, generation_round, saved_character_id, review_note, preview_image_url, created_at, updated_at
    FROM character_batch_candidates
    WHERE id = ?
  `).get(id)
  return mapBatchCandidateRow(row)
}

export function listBatchCandidates(db, batchId, filters = {}) {
  const clauses = ['batch_id = ?']
  const values = [batchId]
  if (filters.classification) {
    clauses.push('classification = ?')
    values.push(filters.classification)
  }
  if (filters.reviewStatus) {
    clauses.push('review_status = ?')
    values.push(filters.reviewStatus)
  }
  const rows = db.prepare(`
    SELECT id, batch_id, source_candidate_id, candidate_json, classification, review_status, similarity_json, errors_json, mutation_json, generation_round, saved_character_id, review_note, preview_image_url, created_at, updated_at
    FROM character_batch_candidates
    WHERE ${clauses.join(' AND ')}
    ORDER BY created_at ASC
  `).all(...values)
  return rows.map(mapBatchCandidateRow)
}

export function updateBatchCandidate(db, id, patch) {
  const current = getBatchCandidate(db, id)
  if (!current) return null
  const next = {
    ...current,
    ...patch,
    id,
    updatedAt: nowIso(),
  }
  db.prepare(`
    UPDATE character_batch_candidates
    SET source_candidate_id=@source_candidate_id,
        classification=@classification,
        review_status=@review_status,
        similarity_json=@similarity_json,
        errors_json=@errors_json,
        mutation_json=@mutation_json,
        generation_round=@generation_round,
        saved_character_id=@saved_character_id,
        review_note=@review_note,
        preview_image_url=@preview_image_url,
        candidate_json=@candidate_json,
        updated_at=@updated_at
    WHERE id=@id
  `).run({
    id,
    source_candidate_id: next.sourceCandidateId || null,
    classification: next.classification,
    review_status: next.reviewStatus,
    similarity_json: next.similarity ? JSON.stringify(next.similarity) : null,
    errors_json: next.errors ? JSON.stringify(next.errors) : null,
    mutation_json: next.mutation ? JSON.stringify(next.mutation) : null,
    generation_round: Number.isInteger(next.generationRound) ? next.generationRound : 1,
    saved_character_id: next.savedCharacterId || null,
    review_note: next.reviewNote || null,
    preview_image_url: next.previewImageUrl || null,
    candidate_json: JSON.stringify(next.candidate || {}),
    updated_at: next.updatedAt,
  })
  const updated = getBatchCandidate(db, id)
  updateCharacterBatch(db, updated.batchId, { status: deriveBatchStatus(db, updated.batchId) })
  return updated
}

export function approveBatchCandidate(db, id) {
  return updateBatchCandidate(db, id, { reviewStatus: 'approved', classification: 'accepted' })
}

export function rejectBatchCandidate(db, id, reason = null) {
  return updateBatchCandidate(db, id, {
    reviewStatus: 'rejected',
    classification: 'rejected',
    reviewNote: reason || null,
  })
}

export function reconsiderBatchCandidate(db, id) {
  return updateBatchCandidate(db, id, {
    reviewStatus: 'pending',
    classification: 'accepted',
    reviewNote: null,
  })
}

export function saveApprovedCandidateAsCharacter(db, id) {
  const candidateRecord = getBatchCandidate(db, id)
  if (!candidateRecord) return null
  if (candidateRecord.reviewStatus !== 'approved') {
    const err = new Error('Candidate must be approved before saving')
    err.status = 400
    throw err
  }
  const saved = createCharacter(db, {
    ...candidateRecord.candidate,
    embeddingStatus: 'not_indexed',
    lifecycleStatus: 'auditioned',
  })
  return updateBatchCandidate(db, id, {
    reviewStatus: 'saved',
    savedCharacterId: saved.id,
  })
}

export function createBankEntry(db, payload) {
  const createdAt = payload.createdAt || nowIso()
  const id = payload.id || randomUUID()
  const record = parseCharacterBankEntry({
    ...payload,
    id,
    createdAt,
    updatedAt: payload.updatedAt || createdAt,
  })
  db.prepare(`
    INSERT INTO character_bank_entries (id, slug, name, description, optimized_description, payload_json, created_at, updated_at)
    VALUES (@id, @slug, @name, @description, @optimized_description, @payload_json, @created_at, @updated_at)
  `).run({
    id: record.id,
    slug: record.slug,
    name: record.name,
    description: record.description,
    optimized_description: record.optimizedDescription ?? null,
    payload_json: JSON.stringify(record),
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  })
  return record
}

export function getBankEntry(db, id) {
  const row = db.prepare('SELECT payload_json FROM character_bank_entries WHERE id = ?').get(id)
  return rowToPayload(row)
}

export function getBankEntryBySlug(db, slug) {
  const row = db.prepare('SELECT payload_json FROM character_bank_entries WHERE slug = ?').get(slug)
  return rowToPayload(row)
}

export function listBankEntries(db, filters = {}) {
  const limit = Number.isInteger(filters.limit) ? filters.limit : null
  const limitSql = limit && limit > 0 ? 'LIMIT ?' : ''
  const values = []
  if (limitSql) values.push(limit)
  const rows = db.prepare(`
    SELECT payload_json
    FROM character_bank_entries
    ORDER BY created_at DESC
    ${limitSql}
  `).all(...values)
  return rows.map(rowToPayload)
}

export function updateBankEntry(db, id, patch) {
  const current = getBankEntry(db, id)
  if (!current) return null
  const merged = parseCharacterBankEntry({
    ...current,
    ...patch,
    id,
    updatedAt: nowIso(),
  })
  db.prepare(`
    UPDATE character_bank_entries
    SET slug = @slug,
        name = @name,
        description = @description,
        optimized_description = @optimized_description,
        payload_json = @payload_json,
        updated_at = @updated_at
    WHERE id = @id
  `).run({
    id: merged.id,
    slug: merged.slug,
    name: merged.name,
    description: merged.description,
    optimized_description: merged.optimizedDescription ?? null,
    payload_json: JSON.stringify(merged),
    updated_at: merged.updatedAt,
  })
  return merged
}

export function deleteBankEntry(db, id) {
  const result = db.prepare('DELETE FROM character_bank_entries WHERE id = ?').run(id)
  return result.changes > 0
}

export function createActorCandidate(db, payload) {
  const createdAt = payload.createdAt || nowIso()
  const id = payload.id || randomUUID()
  const record = parseActorCandidate({
    ...payload,
    id,
    status: payload.status || 'available',
    createdAt,
    updatedAt: payload.updatedAt || createdAt,
  })
  db.prepare(`
    INSERT INTO actor_candidates (id, status, source_bank_entry_id, prompt_pack_id, notes, payload_json, created_at, updated_at)
    VALUES (@id, @status, @source_bank_entry_id, @prompt_pack_id, @notes, @payload_json, @created_at, @updated_at)
  `).run({
    id: record.id,
    status: record.status,
    source_bank_entry_id: record.sourceBankEntryId ?? null,
    prompt_pack_id: record.promptPackId ?? null,
    notes: record.notes ?? null,
    payload_json: JSON.stringify(record),
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  })
  return record
}

export function getActorCandidate(db, id) {
  const row = db.prepare('SELECT payload_json FROM actor_candidates WHERE id = ?').get(id)
  return rowToPayload(row)
}

export function listActorCandidates(db, filters = {}) {
  const clauses = []
  const values = []
  if (filters.status) { clauses.push('status = ?'); values.push(filters.status) }
  if (filters.sourceBankEntryId) { clauses.push('source_bank_entry_id = ?'); values.push(filters.sourceBankEntryId) }
  if (filters.promptPackId) { clauses.push('prompt_pack_id = ?'); values.push(filters.promptPackId) }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const limit = Number.isInteger(filters.limit) ? filters.limit : null
  const limitSql = limit && limit > 0 ? 'LIMIT ?' : ''
  if (limitSql) values.push(limit)
  const rows = db.prepare(`
    SELECT payload_json FROM actor_candidates
    ${whereSql}
    ORDER BY created_at DESC
    ${limitSql}
  `).all(...values)
  return rows.map(rowToPayload)
}

export function updateActorCandidate(db, id, patch) {
  const current = getActorCandidate(db, id)
  if (!current) return null
  const merged = parseActorCandidate({
    ...current,
    ...patch,
    id,
    updatedAt: nowIso(),
  })
  db.prepare(`
    UPDATE actor_candidates
    SET status = @status,
        source_bank_entry_id = @source_bank_entry_id,
        prompt_pack_id = @prompt_pack_id,
        notes = @notes,
        payload_json = @payload_json,
        updated_at = @updated_at
    WHERE id = @id
  `).run({
    id: merged.id,
    status: merged.status,
    source_bank_entry_id: merged.sourceBankEntryId ?? null,
    prompt_pack_id: merged.promptPackId ?? null,
    notes: merged.notes ?? null,
    payload_json: JSON.stringify(merged),
    updated_at: merged.updatedAt,
  })
  return merged
}

export function deleteActorCandidate(db, id) {
  const result = db.prepare('DELETE FROM actor_candidates WHERE id = ?').run(id)
  return result.changes > 0
}

export function createActorAudition(db, payload) {
  const createdAt = payload.createdAt || nowIso()
  const id = payload.id || randomUUID()
  const record = parseActorAudition({
    ...payload,
    id,
    status: payload.status || 'pending',
    createdAt,
    updatedAt: payload.updatedAt || createdAt,
  })
  db.prepare(`
    INSERT INTO actor_auditions (id, actor_candidate_id, bank_entry_id, status, rejected_reason, similarity_score, notes, payload_json, created_at, updated_at)
    VALUES (@id, @actor_candidate_id, @bank_entry_id, @status, @rejected_reason, @similarity_score, @notes, @payload_json, @created_at, @updated_at)
  `).run({
    id: record.id,
    actor_candidate_id: record.actorCandidateId,
    bank_entry_id: record.bankEntryId,
    status: record.status,
    rejected_reason: record.rejectedReason ?? null,
    similarity_score: record.similarityScore ?? null,
    notes: record.notes ?? null,
    payload_json: JSON.stringify(record),
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  })
  return record
}

export function getActorAudition(db, id) {
  const row = db.prepare('SELECT payload_json FROM actor_auditions WHERE id = ?').get(id)
  return rowToPayload(row)
}

export function listActorAuditions(db, filters = {}) {
  const clauses = []
  const values = []
  if (filters.actorCandidateId) { clauses.push('actor_candidate_id = ?'); values.push(filters.actorCandidateId) }
  if (filters.bankEntryId) { clauses.push('bank_entry_id = ?'); values.push(filters.bankEntryId) }
  if (filters.status) { clauses.push('status = ?'); values.push(filters.status) }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const limit = Number.isInteger(filters.limit) ? filters.limit : null
  const limitSql = limit && limit > 0 ? 'LIMIT ?' : ''
  if (limitSql) values.push(limit)
  const rows = db.prepare(`
    SELECT payload_json FROM actor_auditions
    ${whereSql}
    ORDER BY created_at DESC
    ${limitSql}
  `).all(...values)
  return rows.map(rowToPayload)
}

export function updateActorAudition(db, id, patch) {
  const current = getActorAudition(db, id)
  if (!current) return null
  const merged = parseActorAudition({
    ...current,
    ...patch,
    id,
    updatedAt: nowIso(),
  })
  db.prepare(`
    UPDATE actor_auditions
    SET actor_candidate_id = @actor_candidate_id,
        bank_entry_id = @bank_entry_id,
        status = @status,
        rejected_reason = @rejected_reason,
        similarity_score = @similarity_score,
        notes = @notes,
        payload_json = @payload_json,
        updated_at = @updated_at
    WHERE id = @id
  `).run({
    id: merged.id,
    actor_candidate_id: merged.actorCandidateId,
    bank_entry_id: merged.bankEntryId,
    status: merged.status,
    rejected_reason: merged.rejectedReason ?? null,
    similarity_score: merged.similarityScore ?? null,
    notes: merged.notes ?? null,
    payload_json: JSON.stringify(merged),
    updated_at: merged.updatedAt,
  })
  return merged
}

export function deleteActorAudition(db, id) {
  const result = db.prepare('DELETE FROM actor_auditions WHERE id = ?').run(id)
  return result.changes > 0
}

export function upsertComfyJob(db, job) {
  db.prepare(`
    INSERT INTO comfy_jobs (id, prompt_id, character_id, view_type, job_type, prompt_pack_id, workflow_version, status, created_at)
    VALUES (@id, @prompt_id, @character_id, @view_type, @job_type, @prompt_pack_id, @workflow_version, @status, @created_at)
    ON CONFLICT(prompt_id) DO UPDATE SET status = excluded.status
  `).run({
    id: job.id || job.promptId,
    prompt_id: job.promptId,
    character_id: job.characterId || '',
    view_type: job.viewType || job.view || '',
    job_type: job.jobType || 'portfolio',
    prompt_pack_id: job.promptPackId || null,
    workflow_version: job.workflowVersion || null,
    status: job.status || 'queued',
    created_at: job.createdAt || new Date().toISOString(),
  })
}

export function bulkUpsertComfyJobs(db, jobs) {
  const insert = db.transaction((list) => { for (const j of list) upsertComfyJob(db, j) })
  insert(jobs)
}

export function listActiveComfyJobs(db, jobType) {
  const rows = jobType
    ? db.prepare("SELECT * FROM comfy_jobs WHERE status NOT IN ('success','failed') AND job_type = ?").all(jobType)
    : db.prepare("SELECT * FROM comfy_jobs WHERE status NOT IN ('success','failed')").all()
  return rows.map((r) => ({
    promptId: r.prompt_id,
    characterId: r.character_id,
    viewType: r.view_type,
    view: r.view_type,
    jobType: r.job_type,
    promptPackId: r.prompt_pack_id,
    workflowVersion: r.workflow_version,
    status: r.status,
    createdAt: r.created_at,
  }))
}

export function bulkUpdateComfyJobStatus(db, promptIds, status) {
  if (!promptIds.length) return
  const completedAt = (status === 'success' || status === 'failed') ? new Date().toISOString() : null
  const placeholders = promptIds.map(() => '?').join(',')
  db.prepare(`UPDATE comfy_jobs SET status = ?, completed_at = ? WHERE prompt_id IN (${placeholders})`).run(status, completedAt, ...promptIds)
}

// ── Saved Prompts ─────────────────────────────────────────────────────────────

export function listSavedPrompts(db) {
  return db.prepare('SELECT * FROM saved_prompts ORDER BY created_at DESC').all().map((row) => ({
    id: row.id,
    name: row.name,
    text: row.text,
    timestamp: new Date(row.created_at).getTime(),
  }))
}

export function createSavedPrompt(db, { id, name, text }) {
  if (!id || !name || !text) {
    const err = new Error('Missing id, name, or text')
    err.status = 400
    throw err
  }
  const now = nowIso()
  db.prepare('INSERT INTO saved_prompts (id, name, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, name, text, now, now)
  return { id, name, text, timestamp: new Date(now).getTime() }
}

export function deleteSavedPrompt(db, id) {
  return db.prepare('DELETE FROM saved_prompts WHERE id = ?').run(id).changes > 0
}

export function renameSavedPrompt(db, id, name) {
  const now = nowIso()
  const changes = db.prepare('UPDATE saved_prompts SET name = ?, updated_at = ? WHERE id = ?').run(name, now, id).changes
  if (!changes) return null
  const row = db.prepare('SELECT * FROM saved_prompts WHERE id = ?').get(id)
  return { id: row.id, name: row.name, text: row.text, timestamp: new Date(row.created_at).getTime() }
}

// ── Workspace Profiles ────────────────────────────────────────────────────────

export function listWorkspaceProfiles(db) {
  return db.prepare('SELECT * FROM workspace_profiles ORDER BY created_at ASC').all().map((row) => ({
    id: row.id,
    label: row.label,
    state: JSON.parse(row.state_json),
  }))
}

export function upsertWorkspaceProfile(db, { id, label, stateJson }) {
  if (!id || !label) {
    const err = new Error('Missing id or label')
    err.status = 400
    throw err
  }
  const now = nowIso()
  db.prepare(`
    INSERT INTO workspace_profiles (id, label, state_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET label = excluded.label, state_json = excluded.state_json, updated_at = excluded.updated_at
  `).run(id, label, stateJson, now, now)
  const row = db.prepare('SELECT * FROM workspace_profiles WHERE id = ?').get(id)
  return { id: row.id, label: row.label, state: JSON.parse(row.state_json) }
}

export function deleteWorkspaceProfile(db, id) {
  return db.prepare('DELETE FROM workspace_profiles WHERE id = ?').run(id).changes > 0
}
