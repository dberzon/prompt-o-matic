/**
 * Normalizes user input into a snake_case slug.
 */
export function toSnakeSlug(input) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Adds a deterministic numeric suffix to avoid collisions.
 */
export function withUniqueSuffix(baseSlug, characters, currentName) {
  if (!baseSlug) return ''
  const name = String(currentName ?? '').trim()
  const bucket = characters ?? {}
  const direct = bucket[baseSlug]
  if (!direct) return baseSlug
  if (direct?.name === name) return baseSlug

  for (let n = 2; n <= 999; n += 1) {
    const candidate = `${baseSlug}_${n}`
    const existing = bucket[candidate]
    if (!existing || existing?.name === name) return candidate
  }

  return `${baseSlug}_${Date.now()}`
}

/**
 * Resolves exact slug first, then snake<->kebab compatibility.
 */
export function resolveCharacterSlug(slug, characters) {
  const bucket = characters ?? {}
  const normalized = String(slug ?? '').toLowerCase()
  if (!normalized) return null
  if (bucket[normalized]) return normalized

  const alternate = normalized.includes('_')
    ? normalized.replace(/_/g, '-')
    : normalized.replace(/-/g, '_')

  if (bucket[alternate]) return alternate
  return null
}
