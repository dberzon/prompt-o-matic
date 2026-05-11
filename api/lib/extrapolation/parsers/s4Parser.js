import { createEntity, writeAttribute } from '../../db/repositories.js'

function slugify(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function applyS4Parser(db, entityId, parsed) {
  const writes = []
  const suggestions = []
  const environments = Array.isArray(parsed?.environments) ? parsed.environments : []

  for (const env of environments) {
    if (!env?.name) continue
    const environment = createEntity(db, {
      id: `env_${slugify(env.name)}_${entityId}`.slice(0, 120),
      type: 'environment',
      name: env.name,
    })
    suggestions.push(environment)
    if (env.summary) {
      writes.push(writeAttribute(db, {
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
    if (!item?.key) continue
    writes.push(writeAttribute(db, {
      entityId,
      key: item.key,
      value: item.value,
      provenance: 'inferred',
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.7,
      sourceStage: 4,
    }))
  }

  return { writes, suggestions }
}
