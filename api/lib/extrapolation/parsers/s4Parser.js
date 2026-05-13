import { createEntity, writeAttribute } from '../../db/repositories.js'

function slugify(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {unknown} parsed
 * @returns {import('./parserResult.js').ParserResult<ReturnType<typeof writeAttribute>> & { suggestions: unknown[] }}
 */
export function applyS4Parser(db, entityId, parsed) {
  /** @type {ReturnType<typeof writeAttribute>[]} */
  const accepted = []
  /** @type {import('./parserResult.js').ParserDropped[]} */
  const dropped = []
  /** @type {unknown[]} */
  const suggestions = []
  const environments = Array.isArray(parsed?.environments) ? parsed.environments : []

  for (const env of environments) {
    if (!env?.name) {
      dropped.push({ key: null, reason: 'environment_missing_name', raw: env })
      continue
    }
    const environment = createEntity(db, {
      id: `env_${slugify(env.name)}_${entityId}`.slice(0, 120),
      type: 'environment',
      name: env.name,
    })
    suggestions.push(environment)
    if (env.summary) {
      accepted.push(writeAttribute(db, {
        entityId: environment.id,
        key: 'summary',
        value: env.summary,
        provenance: 'suggested',
        confidence: 0.7,
        sourceStage: 4,
      }))
    }
  }

  const attributes = Array.isArray(parsed?.attributes) ? parsed.attributes : []
  for (const item of attributes) {
    if (!item?.key) {
      dropped.push({ key: null, reason: 'missing_attribute_key', raw: item })
      continue
    }
    accepted.push(writeAttribute(db, {
      entityId,
      key: item.key,
      value: item.value,
      provenance: 'inferred',
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.7,
      sourceStage: 4,
    }))
  }

  const relationshipAttributes = Array.isArray(parsed?.relationshipAttributes)
    ? parsed.relationshipAttributes
    : []
  for (const item of relationshipAttributes) {
    if (!item?.type || !item?.otherSlug || item?.value === undefined) {
      dropped.push({
        key: item?.type ? String(item.type) : null,
        reason: 'relationship_attribute_incomplete',
        raw: item,
      })
      continue
    }
    const otherSlug = slugify(item.otherSlug)
    if (!otherSlug) {
      dropped.push({
        key: item?.type ? String(item.type) : null,
        reason: 'relationship_other_slug_empty',
        raw: item,
      })
      continue
    }
    accepted.push(writeAttribute(db, {
      entityId,
      key: `relation.${item.type}:${otherSlug}`,
      value: item.value,
      provenance: 'derived',
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.8,
      sourceStage: 4,
    }))
  }

  return { accepted, dropped, suggestions }
}
