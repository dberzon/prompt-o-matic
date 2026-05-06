function hasText(value) {
  return typeof value === 'string' && value.trim() !== ''
}

function isMissingText(value) {
  return value == null || (typeof value === 'string' && value.trim() === '')
}

export function hydrateActorBankSlots(slots, bankChars) {
  if (!Array.isArray(slots) || !Array.isArray(bankChars) || bankChars.length === 0) {
    return slots
  }

  let changed = false
  const byId = new Map(bankChars.map((c) => [c.id, c]))
  const next = slots.map((slot) => {
    if (!slot?.actorBankId) return slot

    const found = byId.get(slot.actorBankId)
    if (!found) {
      changed = true
      const { actorBankId: _a, name: _n, promptDescriptor: _pd, thumbnailUrl: _t, ...rest } = slot
      return { g: rest.g ?? 'person', a: rest.a ?? '30s', ...rest }
    }

    const patch = {}
    if (isMissingText(slot.name) && hasText(found.name)) {
      patch.name = found.name
    }
    if (isMissingText(slot.promptDescriptor) && hasText(found.promptDescriptor)) {
      patch.promptDescriptor = found.promptDescriptor
    }
    if (isMissingText(slot.thumbnailUrl) && hasText(found.thumbnailUrl)) {
      patch.thumbnailUrl = found.thumbnailUrl
    }

    if (Object.keys(patch).length === 0) return slot
    changed = true
    return { ...slot, ...patch }
  })

  return changed ? next : slots
}
