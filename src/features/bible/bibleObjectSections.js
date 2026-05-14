import { z } from 'zod'

/**
 * Unwrap optional/default wrappers to inner schema (top-level Bible section field).
 *
 * @param {import('zod').ZodTypeAny} fieldSchema
 * @returns {import('zod').ZodTypeAny}
 */
export function unwrapBibleSectionRoot(fieldSchema) {
  let inner = fieldSchema
  while (inner instanceof z.ZodOptional || inner instanceof z.ZodDefault) {
    inner = inner.unwrap()
  }
  return inner
}

/**
 * Top-level bible keys rendered as object section panels (inner ZodObject only).
 * Skips array roots and primitives (e.g. location `weather`).
 *
 * @param {import('zod').ZodObject<any>} rootSchema
 * @returns {Array<{ key: string, sectionSchema: import('zod').ZodObject<any> }>}
 */
export function listBibleObjectSectionEntries(rootSchema) {
  if (!(rootSchema instanceof z.ZodObject)) return []
  /** @type {Array<{ key: string, sectionSchema: import('zod').ZodObject<any> }>} */
  const out = []
  for (const key of Object.keys(rootSchema.shape)) {
    const inner = unwrapBibleSectionRoot(rootSchema.shape[key])
    if (inner instanceof z.ZodObject) {
      out.push({ key, sectionSchema: inner })
    }
  }
  return out
}

/**
 * Provenance map keyed by field name within a section (from flat dot-path provenance).
 *
 * @param {Record<string, unknown>} flatProvenance
 * @param {string} section
 * @returns {Record<string, unknown>}
 */
export function provenanceForSectionFields(flatProvenance, section) {
  /** @type {Record<string, unknown>} */
  const out = {}
  if (!flatProvenance || typeof flatProvenance !== 'object') return out
  const prefix = `${section}.`
  for (const [path, prov] of Object.entries(flatProvenance)) {
    if (!path.startsWith(prefix)) continue
    const rest = path.slice(prefix.length)
    const dot = rest.indexOf('.')
    const fieldKey = dot >= 0 ? rest.slice(0, dot) : rest
    if (fieldKey && out[fieldKey] === undefined) {
      out[fieldKey] = prov
    }
  }
  return out
}
