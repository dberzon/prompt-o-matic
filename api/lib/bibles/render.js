import { z } from 'zod'
import PDFDocument from 'pdfkit'
import { readSectionRequirement } from './schemas/_sectionMarkers.js'
import { CharacterBibleSchema } from './schemas/characterBible.schema.js'
import { EraBibleSchema } from './schemas/eraBible.schema.js'
import { LocationBibleSchema } from './schemas/locationBible.schema.js'
import { PropBibleSchema } from './schemas/propBible.schema.js'

/** @typedef {import('zod').ZodObject<any>} ZodObjectAny */

const RECOMMENDED_PLACEHOLDER = '_(not yet specified)_'

/**
 * @param {Record<string, unknown>} bible
 * @returns {ZodObjectAny}
 */
export function detectBibleRootSchema(bible) {
  const o = stripProvenance(bible)
  if ('demographics' in o) return CharacterBibleSchema
  if ('geography' in o && 'identity' in o) return LocationBibleSchema
  if ('timeframe' in o) return EraBibleSchema
  if ('function' in o && 'visuals' in o && !('demographics' in o) && !('geography' in o)) return PropBibleSchema
  throw new Error('renderBibleMarkdown: unrecognized bible projection shape')
}

/**
 * @param {unknown} bible
 * @returns {Record<string, unknown>}
 */
export function stripProvenance(bible) {
  if (!bible || typeof bible !== 'object') return {}
  const { _provenance: _p, ...rest } = /** @type {Record<string, unknown>} */ (bible)
  return rest
}

/**
 * @param {import('zod').ZodTypeAny} s
 * @returns {boolean}
 */
function hasDefaultEmptyArray(s) {
  let cur = s
  while (cur instanceof z.ZodOptional) {
    cur = cur.unwrap()
  }
  if (cur instanceof z.ZodDefault) {
    const dv = cur.def?.defaultValue
    return Array.isArray(dv) && dv.length === 0
  }
  return false
}

/**
 * @param {import('zod').ZodTypeAny} sectionRootSchema
 * @returns {'required' | 'recommended'}
 */
function tierForTopLevelSection(sectionRootSchema) {
  const req = readSectionRequirement(sectionRootSchema)
  if (req === 'required' || req === 'recommended') {
    return req
  }
  if (sectionRootSchema instanceof z.ZodOptional) {
    return 'recommended'
  }
  return 'required'
}

/**
 * @param {unknown} v
 * @returns {boolean}
 */
function primitiveNonEmpty(v) {
  if (v === undefined || v === null) return false
  if (typeof v === 'string') {
    return v.trim().length > 0
  }
  if (typeof v === 'number' || typeof v === 'boolean') {
    return true
  }
  return false
}

/**
 * @param {unknown} v
 * @returns {boolean}
 */
function primitiveStringArrayNonEmpty(v) {
  if (!Array.isArray(v) || v.length === 0) return false
  return v.some((x) => typeof x === 'string' && x.trim().length > 0)
}

/**
 * @param {string} key
 * @returns {string}
 */
function humanizeKey(key) {
  const spaced = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')
  return spaced.replace(/^\s+/, '').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * @param {import('zod').ZodTypeAny} fieldSchema
 * @returns {import('zod').ZodTypeAny}
 */
function unwrapOptionalDefault(fieldSchema) {
  let cur = fieldSchema
  while (cur instanceof z.ZodOptional || cur instanceof z.ZodDefault) {
    cur = cur.unwrap()
  }
  return cur
}

/**
 * @param {import('zod').ZodTypeAny} fieldSchema
 * @returns {boolean}
 */
function fieldAllowsMissingLeaf(fieldSchema) {
  if (fieldSchema instanceof z.ZodOptional) return true
  if (fieldSchema instanceof z.ZodDefault && hasDefaultEmptyArray(fieldSchema)) return true
  return false
}

/**
 * @param {'required' | 'recommended'} sectionTier
 * @param {import('zod').ZodTypeAny} fieldSchema
 * @returns {'required' | 'recommended'}
 */
function leafTier(sectionTier, fieldSchema) {
  if (sectionTier === 'required' && fieldSchema instanceof z.ZodOptional) {
    return 'recommended'
  }
  return sectionTier
}

/**
 * @param {unknown} value
 * @param {import('zod').ZodArray<any>} arrSchema
 * @param {'required' | 'recommended'} tier
 * @param {import('zod').ZodTypeAny} sectionRootSchema
 * @returns {string[]}
 */
function renderZodArray(value, arrSchema, tier, sectionRootSchema) {
  const elem = arrSchema.element
  if (!Array.isArray(value) || value.length === 0) {
    if (tier === 'recommended' || hasDefaultEmptyArray(sectionRootSchema)) {
      return [RECOMMENDED_PLACEHOLDER, '']
    }
    return [`> **Missing required field:** content for this list is empty.`, '']
  }
  const lines = []
  if (elem instanceof z.ZodObject) {
    value.forEach((row, idx) => {
      if (!row || typeof row !== 'object') return
      const o = /** @type {Record<string, unknown>} */ (row)
      lines.push(`#### Entry ${idx + 1}`)
      lines.push('')
      lines.push(...renderInnerObjectFields(o, elem, tier))
    })
    return lines
  }
  for (const item of value) {
    if (typeof item === 'string') {
      lines.push(`- ${item.trim() || RECOMMENDED_PLACEHOLDER}`)
    } else {
      lines.push(`- ${String(item)}`)
    }
  }
  lines.push('')
  return lines
}

/**
 * @param {unknown} value
 * @param {import('zod').ZodTypeAny} fieldSchema
 * @param {'required' | 'recommended'} tier
 * @returns {string}
 */
function formatLeafValue(value, fieldSchema, tier) {
  const inner = unwrapOptionalDefault(fieldSchema)
  if (inner instanceof z.ZodArray) {
    if (!primitiveStringArrayNonEmpty(value)) {
      if (tier === 'recommended' || hasDefaultEmptyArray(fieldSchema)) {
        return RECOMMENDED_PLACEHOLDER
      }
      return `> **Missing required field:** list is empty.`
    }
    return (/** @type {string[]} */ (value))
      .filter((x) => typeof x === 'string' && x.trim())
      .join(', ')
  }
  if (!primitiveNonEmpty(value)) {
    if (tier === 'recommended' || fieldAllowsMissingLeaf(fieldSchema)) {
      return RECOMMENDED_PLACEHOLDER
    }
    return `> **Missing required field** (expected a non-empty value).`
  }
  return String(value).trim()
}

/**
 * @param {Record<string, unknown>} data
 * @param {ZodObjectAny} innerSchema
 * @param {'required' | 'recommended'} sectionTier
 * @returns {string[]}
 */
function renderInnerObjectFields(data, innerSchema, sectionTier) {
  const lines = []
  for (const fieldKey of Object.keys(innerSchema.shape)) {
    const fieldSchema = innerSchema.shape[fieldKey]
    const tier = leafTier(sectionTier, fieldSchema)
    const raw = data[fieldKey]
    const inner = unwrapOptionalDefault(fieldSchema)

    lines.push(`### ${humanizeKey(fieldKey)}`)
    lines.push('')

    if (inner instanceof z.ZodObject) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        lines.push(tier === 'recommended' ? RECOMMENDED_PLACEHOLDER : `> **Missing required field:** \`${fieldKey}\` object.`)
        lines.push('')
        continue
      }
      const subLines = renderInnerObjectFields(/** @type {Record<string, unknown>} */ (raw), inner, tier)
      for (const sl of subLines) {
        lines.push(sl)
      }
      continue
    }

    if (inner instanceof z.ZodArray) {
      const sub = renderZodArray(raw, inner, tier, fieldSchema)
      for (const sl of sub) lines.push(sl)
      continue
    }

    const text = formatLeafValue(raw, fieldSchema, tier)
    lines.push(text)
    lines.push('')
  }
  return lines
}

/**
 * @param {string} key
 * @param {unknown} rawVal
 * @param {import('zod').ZodTypeAny} sectionRoot
 * @param {ZodObjectAny} _rootSchema
 * @returns {string[]}
 */
function renderOneTopLevelSection(key, rawVal, sectionRoot, _rootSchema) {
  const tier = tierForTopLevelSection(sectionRoot)
  const lines = [`## ${humanizeKey(key)}`, '']

  const missingSection = () => {
    if (tier === 'recommended' || hasDefaultEmptyArray(sectionRoot)) {
      lines.push(RECOMMENDED_PLACEHOLDER)
    } else {
      lines.push(`> **Missing required Bible section:** \`${key}\``)
    }
    lines.push('')
    return lines
  }

  if (rawVal === undefined || rawVal === null) {
    return missingSection()
  }

  let core = sectionRoot
  while (core instanceof z.ZodOptional || core instanceof z.ZodDefault) {
    core = core.unwrap()
  }

  if (core instanceof z.ZodObject) {
    if (typeof rawVal !== 'object' || !rawVal || Array.isArray(rawVal)) {
      lines.push(tier === 'recommended' ? RECOMMENDED_PLACEHOLDER : `> **Missing required Bible section:** \`${key}\``)
      lines.push('')
      return lines
    }
    const body = renderInnerObjectFields(/** @type {Record<string, unknown>} */ (rawVal), core, tier)
    for (const b of body) lines.push(b)
    lines.push('')
    return lines
  }

  if (core instanceof z.ZodArray) {
    for (const l of renderZodArray(rawVal, core, tier, sectionRoot)) lines.push(l)
    lines.push('')
    return lines
  }

  if (core instanceof z.ZodString || core instanceof z.ZodNumber || core instanceof z.ZodBoolean) {
    if (!primitiveNonEmpty(rawVal) && rawVal !== 0 && rawVal !== false) {
      lines.push(tier === 'recommended' || sectionRoot instanceof z.ZodOptional ? RECOMMENDED_PLACEHOLDER : `> **Missing required field:** \`${key}\``)
    } else {
      lines.push(String(rawVal))
    }
    lines.push('')
    return lines
  }

  lines.push(String(rawVal))
  lines.push('')
  return lines
}

/**
 * Render a projected Bible (or snapshot bible JSON) as Markdown.
 * One `##` heading per top-level Bible section, in schema order.
 *
 * @param {unknown} bible
 * @returns {string}
 */
export function renderBibleMarkdown(bible) {
  const root = detectBibleRootSchema(bible)
  const data = stripProvenance(bible)
  const parts = []
  for (const key of Object.keys(root.shape)) {
    const sectionRoot = root.shape[key]
    const rawVal = data[key]
    parts.push(...renderOneTopLevelSection(key, rawVal, sectionRoot, root))
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

/**
 * One-shot PDF render of Markdown (subset: ##, ###, ####, paragraphs, blockquotes, bullets).
 *
 * @param {string} markdown
 * @returns {Promise<Buffer>}
 */
export function renderBiblePdf(markdown) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER', bufferPages: false })
    /** @type {Buffer[]} */
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const left = 50
    const width = 512
    let y = 50
    const pageBottom = 742

    /**
     * @param {number} h
     */
    function advance(h) {
      y += h
      if (y > pageBottom) {
        doc.addPage()
        y = 50
      }
    }

    const lines = markdown.split('\n')
    for (const line of lines) {
      const trimmed = line.trimEnd()
      if (trimmed === '') {
        advance(8)
        continue
      }
      if (trimmed.startsWith('#### ')) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#222222')
        const t = trimmed.slice(5)
        const h = doc.heightOfString(t, { width })
        doc.text(t, left, y, { width })
        advance(h + 4)
        doc.fillColor('#000000')
        continue
      }
      if (trimmed.startsWith('### ')) {
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#111111')
        const t = trimmed.slice(4)
        const h = doc.heightOfString(t, { width })
        doc.text(t, left, y, { width })
        advance(h + 6)
        doc.fillColor('#000000')
        continue
      }
      if (trimmed.startsWith('## ')) {
        doc.font('Helvetica-Bold').fontSize(16).fillColor('#000000')
        const t = trimmed.slice(3)
        const h = doc.heightOfString(t, { width })
        doc.text(t, left, y, { width })
        advance(h + 10)
        continue
      }
      if (trimmed.startsWith('>')) {
        const body = trimmed.replace(/^>\s?/, '')
        doc.font('Helvetica-Oblique').fontSize(10).fillColor('#444444')
        const h = doc.heightOfString(body, { width: width - 12 })
        doc.text(body, left + 12, y, { width: width - 12 })
        advance(h + 6)
        doc.fillColor('#000000').font('Helvetica')
        continue
      }
      doc.font('Helvetica').fontSize(11).fillColor('#000000')
      const h = doc.heightOfString(trimmed, { width })
      doc.text(trimmed, left, y, { width })
      advance(h + 4)
    }

    doc.end()
  })
}
