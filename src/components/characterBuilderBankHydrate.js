/**
 * Merge Actor Bank rows into the local characters cache.
 * @param {Record<string, unknown>} prev
 * @param {Array<Record<string, unknown>>} items
 */
export function mergeBankEntriesIntoCharacters(prev, items) {
  const merged = { ...(prev && typeof prev === 'object' ? prev : {}) }
  for (const bankEntry of items) {
    if (!bankEntry?.slug) continue
    merged[bankEntry.slug] = {
      slug: bankEntry.slug,
      name: bankEntry.name,
      rawDescription: bankEntry.description,
      optimizedDescription: bankEntry.optimizedDescription || '',
      createdAt: new Date(bankEntry.createdAt).getTime(),
    }
  }
  return merged
}

/** @param {number} startedId @param {number} currentId @param {boolean} cancelled */
export function isBankHydrateCurrent(startedId, currentId, cancelled) {
  return !cancelled && startedId === currentId
}
