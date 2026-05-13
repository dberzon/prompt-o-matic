/**
 * Bible section Zod helpers — attach `requirement` metadata for UI / completeness.
 * @import { z } from 'zod'
 */

/**
 * @template {import('zod').ZodTypeAny} T
 * @param {T} schema
 * @returns {T}
 */
export function required(schema) {
  return /** @type {T} */ (schema.meta({ requirement: 'required' }))
}

/**
 * @template {import('zod').ZodTypeAny} T
 * @param {T} schema
 * @returns {T}
 */
export function recommended(schema) {
  return /** @type {T} */ (schema.meta({ requirement: 'recommended' }))
}

/**
 * Read `requirement` from a CharacterBible top-level field (unwraps optional/default wrappers).
 * @param {import('zod').ZodTypeAny} fieldSchema
 * @returns {'required' | 'recommended' | undefined}
 */
export function readSectionRequirement(fieldSchema) {
  let current = fieldSchema
  while (current) {
    if (typeof current.meta === 'function') {
      const m = current.meta()
      if (m && typeof m.requirement === 'string') {
        return m.requirement
      }
    }
    if (typeof current.unwrap !== 'function') {
      break
    }
    const t = current.def?.type
    if (t !== 'optional' && t !== 'default') {
      break
    }
    current = current.unwrap()
  }
  return undefined
}
