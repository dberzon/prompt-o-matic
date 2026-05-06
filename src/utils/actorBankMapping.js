// Derive Prompt Builder character slot fields (g, a) from an Actor Bank character.

export function genderPresentationToG(genderPresentation) {
  const v = String(genderPresentation ?? '').trim().toLowerCase()
  if (!v) return 'person'
  if (v.startsWith('female') || v === 'woman' || v === 'f') return 'woman'
  if (v.startsWith('male') || v === 'man' || v === 'm') return 'man'
  return 'person'
}

export function ageToBracket(age) {
  if (age == null) return '30s'
  const n = typeof age === 'number' ? age : Number(age)
  if (!Number.isFinite(n)) return '30s'
  if (n <= 12) return 'child'
  if (n <= 19) return 'teen'
  if (n <= 29) return '20s'
  if (n <= 39) return '30s'
  if (n <= 49) return '40s'
  if (n <= 59) return '50s'
  if (n <= 69) return '60s'
  return 'elderly'
}
