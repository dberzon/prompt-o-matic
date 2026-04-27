function ensureAnchors(text) {
  const t = text.toLowerCase()
  if (t.includes('not cgi') && t.includes('analog photography')) return text
  return `${text}, photorealistic, analog photography, not CGI, not illustrated`
}

export function generatePromptVariants(parts = []) {
  const base = parts.join(', ').trim()
  if (!base) return []

  const composition = ensureAnchors(
    `${base}, figures at left third of frame, large negative space right`
  )
  const textureLight = ensureAnchors(
    `${base}, rain-soaked surfaces, reflections of sky in wet ground, single practical lamp, warm pool in dark room`
  )
  const colorFilm = ensureAnchors(
    `${base}, cool blue-gray, low contrast midtones, Kodak Vision3 5219, rich shadows, neutral highlights`
  )

  return [
    { id: 'composition', label: 'Composition focus', text: composition },
    { id: 'texture-light', label: 'Texture + light focus', text: textureLight },
    { id: 'color-film', label: 'Color + film focus', text: colorFilm },
  ]
}
