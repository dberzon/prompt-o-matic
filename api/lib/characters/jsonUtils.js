function stripCodeFences(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return match ? match[1].trim() : null
}

function findFirstJsonBlock(text) {
  const startCandidates = [text.indexOf('{'), text.indexOf('[')].filter((i) => i >= 0)
  if (startCandidates.length === 0) return null
  const start = Math.min(...startCandidates)
  const opener = text[start]
  const closer = opener === '{' ? '}' : ']'

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === opener) depth += 1
    if (ch === closer) {
      depth -= 1
      if (depth === 0) {
        return text.slice(start, i + 1).trim()
      }
    }
  }
  return null
}

function normalizeJsonText(text) {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
}

export function extractLikelyJsonText(input) {
  if (typeof input !== 'string' || !input.trim()) return null
  const direct = input.trim()
  if (direct.startsWith('{') || direct.startsWith('[')) return direct

  const fenced = stripCodeFences(input)
  if (fenced) return fenced

  return findFirstJsonBlock(input)
}

export function parseJsonFromLlmText(input) {
  const candidate = extractLikelyJsonText(input)
  if (!candidate) {
    throw new Error('No JSON content found in LLM response')
  }

  try {
    return JSON.parse(candidate)
  } catch {
    const repaired = normalizeJsonText(candidate)
    try {
      return JSON.parse(repaired)
    } catch {
      throw new Error('Unable to parse JSON from LLM response')
    }
  }
}
