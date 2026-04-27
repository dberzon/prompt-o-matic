const BASE_NEGATIVES = [
  'cgi',
  '3d render',
  'illustration',
  'anime style',
  'plastic skin',
  'airbrushed skin',
  'over-smoothed face',
  'lowres',
  'watermark',
  'text artifacts',
]

const FACE_NEGATIVES = [
  'deformed face',
  'asymmetrical eyes',
  'cross-eye',
  'extra eyes',
  'extra mouth',
  'bad teeth',
  'mutated hands',
  'extra fingers',
]

const VIEW_NEGATIVES = {
  front_portrait: ['profile-only angle', 'hidden face'],
  three_quarter_portrait: ['full profile silhouette', 'front-facing passport pose'],
  profile_portrait: ['front-facing angle', 'three-quarter angle'],
  full_body: ['cropped body', 'missing legs', 'missing feet'],
  audition_still: ['dramatic fantasy scene', 'heavy surreal effects'],
  cinematic_scene: ['studio backdrop', 'flat product-shot lighting'],
  other: [],
}

export function buildNegativePrompt({ include = true, view = 'other' } = {}) {
  if (!include) return ''
  const merged = [
    ...BASE_NEGATIVES,
    ...FACE_NEGATIVES,
    ...(VIEW_NEGATIVES[view] || []),
  ]
  return Array.from(new Set(merged)).join(', ')
}
