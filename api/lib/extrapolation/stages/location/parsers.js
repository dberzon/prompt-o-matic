import { writeAttribute } from '../../../db/repositories.js'
import { LocationGeographyStageSchema, LocationHistoryStageSchema, LocationInhabitantsStageSchema } from './schemas.js'

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {unknown} parsed
 * @param {{ sourceStage: number }} meta
 */
export function applyLocationGeographyParser(db, entityId, parsed, meta) {
  const out = LocationGeographyStageSchema.safeParse(parsed)
  /** @type {ReturnType<typeof writeAttribute>[]} */
  const writes = []
  /** @type {import('../../parsers/parserResult.js').ParserDropped[]} */
  const dropped = []
  if (!out.success) {
    dropped.push({ key: null, reason: 'geography_schema_invalid', raw: parsed })
    return { writes, dropped, suggestions: [], conflicts: [] }
  }
  const g = out.data
  writes.push(
    writeAttribute(db, {
      entityId,
      key: 'geography.placement',
      value: g.placement,
      provenance: 'inferred',
      confidence: 0.85,
      sourceStage: meta.sourceStage,
    }),
  )
  if (g.architecturalNotes != null && String(g.architecturalNotes).trim()) {
    writes.push(
      writeAttribute(db, {
        entityId,
        key: 'geography.architecturalNotes',
        value: g.architecturalNotes,
        provenance: 'inferred',
        confidence: 0.75,
        sourceStage: meta.sourceStage,
      }),
    )
  }
  return { writes, dropped, suggestions: [], conflicts: [] }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {unknown} parsed
 * @param {{ sourceStage: number }} meta
 */
export function applyLocationInhabitantsParser(db, entityId, parsed, meta) {
  const out = LocationInhabitantsStageSchema.safeParse(parsed)
  /** @type {ReturnType<typeof writeAttribute>[]} */
  const writes = []
  /** @type {import('../../parsers/parserResult.js').ParserDropped[]} */
  const dropped = []
  if (!out.success) {
    dropped.push({ key: 'inhabitants', reason: 'inhabitants_schema_invalid', raw: parsed })
    return { writes, dropped, suggestions: [], conflicts: [] }
  }
  const list = out.data.inhabitants.filter((s) => String(s).trim())
  for (const s of list) {
    if (!String(s).trim()) {
      dropped.push({ key: 'inhabitants', reason: 'inhabitant_empty_string', raw: s })
    }
  }
  const cleaned = list.map((s) => String(s).trim()).filter(Boolean)
  writes.push(
    writeAttribute(db, {
      entityId,
      key: 'inhabitants',
      value: cleaned,
      provenance: 'inferred',
      confidence: 0.7,
      sourceStage: meta.sourceStage,
    }),
  )
  return { writes, dropped, suggestions: [], conflicts: [] }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {unknown} parsed
 * @param {{ sourceStage: number }} meta
 */
export function applyLocationHistoryParser(db, entityId, parsed, meta) {
  const out = LocationHistoryStageSchema.safeParse(parsed)
  /** @type {ReturnType<typeof writeAttribute>[]} */
  const writes = []
  /** @type {import('../../parsers/parserResult.js').ParserDropped[]} */
  const dropped = []
  if (!out.success) {
    dropped.push({ key: null, reason: 'history_schema_invalid', raw: parsed })
    return { writes, dropped, suggestions: [], conflicts: [] }
  }
  const h = out.data
  if (h.eraOrPeriod != null && String(h.eraOrPeriod).trim()) {
    writes.push(
      writeAttribute(db, {
        entityId,
        key: 'identity.eraOrPeriod',
        value: h.eraOrPeriod,
        provenance: 'inferred',
        confidence: 0.75,
        sourceStage: meta.sourceStage,
      }),
    )
  }
  if (h.weather != null && String(h.weather).trim()) {
    writes.push(
      writeAttribute(db, {
        entityId,
        key: 'weather',
        value: h.weather,
        provenance: 'inferred',
        confidence: 0.7,
        sourceStage: meta.sourceStage,
      }),
    )
  }
  if (h.sensoryAtmosphere != null && String(h.sensoryAtmosphere).trim()) {
    writes.push(
      writeAttribute(db, {
        entityId,
        key: 'sensoryAtmosphere',
        value: h.sensoryAtmosphere,
        provenance: 'inferred',
        confidence: 0.7,
        sourceStage: meta.sourceStage,
      }),
    )
  }
  if (h.periodFixtures?.length) {
    writes.push(
      writeAttribute(db, {
        entityId,
        key: 'periodFixtures',
        value: h.periodFixtures.map((x) => String(x).trim()).filter(Boolean),
        provenance: 'inferred',
        confidence: 0.65,
        sourceStage: meta.sourceStage,
      }),
    )
  }
  return { writes, dropped, suggestions: [], conflicts: [] }
}

/**
 * Persist parser drops as temporary diagnostic rows (per arch acceptance).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {number} sourceStage
 * @param {import('../../parsers/parserResult.js').ParserDropped[]} dropped
 */
export function persistLocationDropDiagnostics(db, entityId, sourceStage, dropped) {
  /** @type {ReturnType<typeof writeAttribute>[]} */
  const writes = []
  let i = 0
  for (const d of dropped) {
    i += 1
    const key = `location.drop.${sourceStage}.${i}_${String(d.reason).replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 80)}`
    writes.push(
      writeAttribute(db, {
        entityId,
        key,
        value: { reason: d.reason, key: d.key, raw: d.raw ?? null },
        provenance: 'temporary',
        confidence: null,
        sourceStage,
      }),
    )
  }
  return writes
}
