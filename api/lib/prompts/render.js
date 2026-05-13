/** @typedef {{ warn?: (msg: string) => void }} RenderOptions */

export class PromptRenderError extends Error {
  /**
   * @param {string} message
   * @param {{ template?: string; cause?: unknown }} [meta]
   */
  constructor(message, meta = {}) {
    super(message)
    this.name = 'PromptRenderError'
    this.template = meta.template ?? ''
    this.cause = meta.cause
  }
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string} path
 * @param {(msg: string) => void} [warn]
 * @returns {unknown}
 */
function rawLookup(obj, path, warn) {
  const keys = path.split('.').filter(Boolean)
  let cur = obj
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') {
      cur = undefined
      break
    }
    cur = /** @type {Record<string, unknown>} */ (cur)[k]
  }
  if (cur === undefined && warn) {
    warn(`Missing template variable: ${path}`)
  }
  return cur
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string} path
 * @param {(msg: string) => void} [warn]
 */
function lookup(obj, path, warn) {
  const cur = rawLookup(obj, path, warn)
  if (cur === undefined || cur === null) {
    return ''
  }
  if (typeof cur === 'object') {
    return cur
  }
  return String(cur)
}

/**
 * @param {string} template
 * @param {number} from
 */
function skipTag(template, from) {
  const end = template.indexOf('}}', from)
  if (end === -1) {
    throw new PromptRenderError('Unclosed {{ tag', { template })
  }
  return end + 2
}

/**
 * @param {string} body
 * @param {string} blockName
 */
function splitBalancedBlock(body, blockName) {
  const openRe = new RegExp(`\\{\\{#${blockName}\\b`, 'g')
  const closeStr = `{{/${blockName}}}`
  let depth = 1
  let i = 0
  while (i < body.length && depth > 0) {
    openRe.lastIndex = i
    const om = openRe.exec(body)
    const closeIdx = body.indexOf(closeStr, i)
    if (closeIdx === -1) {
      throw new PromptRenderError(`Missing {{/${blockName}}}`, { template: body })
    }
    if (om && om.index < closeIdx) {
      depth += 1
      i = skipTag(body, om.index + 2)
    } else {
      depth -= 1
      if (depth === 0) {
        return { inner: body.slice(0, closeIdx), rest: body.slice(closeIdx + closeStr.length) }
      }
      i = closeIdx + closeStr.length
    }
  }
  throw new PromptRenderError(`Unbalanced {{#${blockName}}}`, { template: body })
}

/**
 * @param {string} inner
 */
function splitIfBranches(inner) {
  const elseToken = '{{else}}'
  let depth = 0
  let i = 0
  while (i < inner.length) {
    const ifOpen = inner.indexOf('{{#if', i)
    const eachOpen = inner.indexOf('{{#each', i)
    const ifClose = inner.indexOf('{{/if}}', i)
    const eachClose = inner.indexOf('{{/each}}', i)
    const elseIdx = inner.indexOf(elseToken, i)

    const next = [
      ifOpen === -1 ? Infinity : ifOpen,
      eachOpen === -1 ? Infinity : eachOpen,
      ifClose === -1 ? Infinity : ifClose,
      eachClose === -1 ? Infinity : eachClose,
      elseIdx === -1 ? Infinity : elseIdx,
    ]
    const min = Math.min(...next)
    if (min === Infinity) {
      return { thenPart: inner, elsePart: '' }
    }
    if (min === elseIdx && depth === 0) {
      return { thenPart: inner.slice(0, elseIdx), elsePart: inner.slice(elseIdx + elseToken.length) }
    }
    if (min === ifOpen) {
      depth += 1
      i = skipTag(inner, ifOpen + 2)
      continue
    }
    if (min === eachOpen) {
      depth += 1
      i = skipTag(inner, eachOpen + 2)
      continue
    }
    if (min === ifClose) {
      depth -= 1
      i = ifClose + '{{/if}}'.length
      continue
    }
    if (min === eachClose) {
      depth -= 1
      i = eachClose + '{{/each}}'.length
      continue
    }
    i = min + 1
  }
  return { thenPart: inner, elsePart: '' }
}

/**
 * @param {string} template
 * @param {Record<string, unknown>} variables
 * @param {(msg: string) => void} warn
 */
function renderFragment(template, variables, warn) {
  let out = ''
  let pos = 0
  while (pos < template.length) {
    const start = template.indexOf('{{', pos)
    if (start === -1) {
      out += template.slice(pos)
      break
    }
    out += template.slice(pos, start)
    if (template.slice(start, start + 5) === '{{else}}') {
      throw new PromptRenderError('Unexpected {{else}}', { template })
    }
    if (template.startsWith('{{#if', start)) {
      const openEnd = template.indexOf('}}', start)
      if (openEnd === -1) {
        throw new PromptRenderError('Unclosed {{#if', { template })
      }
      const cond = template.slice(start + '{{#if'.length, openEnd).trim()
      const afterOpen = template.slice(openEnd + 2)
      const { inner, rest } = splitBalancedBlock(afterOpen, 'if')
      const truthy = Boolean(rawLookup(variables, cond, warn))
      const { thenPart, elsePart } = splitIfBranches(inner)
      out += truthy ? renderFragment(thenPart, variables, warn) : renderFragment(elsePart, variables, warn)
      pos = openEnd + 2 + inner.length + '{{/if}}'.length
      continue
    }
    if (template.startsWith('{{#each', start)) {
      const openEnd = template.indexOf('}}', start)
      if (openEnd === -1) {
        throw new PromptRenderError('Unclosed {{#each', { template })
      }
      const listPath = template.slice(start + '{{#each'.length, openEnd).trim()
      const afterOpen = template.slice(openEnd + 2)
      const { inner, rest: _rest } = splitBalancedBlock(afterOpen, 'each')
      const listRaw = rawLookup(variables, listPath, warn)
      const list = Array.isArray(listRaw) ? listRaw : []
      let eachOut = ''
      for (const item of list) {
        const itemCtx =
          item != null && typeof item === 'object'
            ? /** @type {Record<string, unknown>} */ ({ ...variables, this: item, .../** @type {Record<string, unknown>} */ (item) })
            : { ...variables, this: item }
        eachOut += renderFragment(inner, itemCtx, warn)
      }
      out += eachOut
      pos = openEnd + 2 + inner.length + '{{/each}}'.length
      continue
    }
    const end = template.indexOf('}}', start)
    if (end === -1) {
      throw new PromptRenderError('Unclosed {{', { template })
    }
    const expr = template.slice(start + 2, end).trim()
    if (expr.startsWith('#') || expr.startsWith('/')) {
      throw new PromptRenderError(`Unsupported block tag: ${expr}`, { template })
    }
    const val = lookup(variables, expr, warn)
    out += typeof val === 'object' && val !== null ? '' : String(val)
    pos = end + 2
  }
  return out
}

/**
 * @param {string} template
 * @param {Record<string, unknown>} variables
 * @param {RenderOptions} [options]
 */
export function renderPrompt(template, variables, options = {}) {
  const warn = typeof options.warn === 'function' ? options.warn : () => {}
  try {
    return renderFragment(template, variables, warn)
  } catch (e) {
    if (e instanceof PromptRenderError) {
      e.template ||= template
      throw e
    }
    throw new PromptRenderError(String(/** @type {Error} */ (e)?.message || e), { template, cause: e })
  }
}
