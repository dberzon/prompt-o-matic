/**
 * Lightweight heuristic quality score for assembled prompts (0–100).
 * Not a model — signals specificity, anti-CGI anchors, and light discipline.
 */

const ANTI_CGI = /not cgi|photorealistic|analog|film grain|imperfect|non-idealized|documentary register|real worn/i
const FILM = /kodak|fuji|35mm|16mm|tri-x|vision3|eterna|film halation|grain/i
const LIGHT = /overcast|neon|practical|magic hour|contre-jour|institutional|winter sun|fog-filtered|beam|lamp|screen light|fading afternoon|candlelight/i
const MATERIAL = /concrete|rust|mud|plaster|water|fog|rain|texture|worn|aggregate|brick|steel|glass|wet/i

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

export function scorePromptQuality({ assembledText = '', chips = {}, scenario = null, scene = '' }) {
  const text = assembledText.trim()
  const words = text ? text.split(/\s+/).length : 0
  const breakdown = []

  let total = 0

  // Length / specificity (0–25)
  let lengthScore = 0
  if (words >= 55) lengthScore = 25
  else if (words >= 35) lengthScore = 20
  else if (words >= 20) lengthScore = 14
  else if (words >= 10) lengthScore = 8
  else lengthScore = words > 0 ? 4 : 0
  breakdown.push({ key: 'length', label: 'Prompt density', score: lengthScore, max: 25, hint: words < 25 ? 'Add scene or chips for more material detail.' : '' })
  total += lengthScore

  // Scenario + scene context (0–15)
  let contextScore = 0
  if (scenario && String(scenario).trim()) contextScore += 10
  if (scene && String(scene).trim()) contextScore += 5
  breakdown.push({ key: 'context', label: 'Subject + scene', score: contextScore, max: 15, hint: !scenario ? 'Pick a scenario for stronger subject anchoring.' : '' })
  total += contextScore

  // Anti-CGI / photoreal anchors (0–20)
  const anti = ANTI_CGI.test(text) ? 20 : 0
  breakdown.push({ key: 'anti', label: 'Anti-CGI anchors', score: anti, max: 20, hint: anti < 20 ? 'Add qualifier chips or polish output.' : '' })
  total += anti

  // Film / stock language (0–15)
  const film = FILM.test(text) ? 15 : 0
  breakdown.push({ key: 'film', label: 'Film stock language', score: film, max: 15, hint: film < 15 ? 'Add a film chip (e.g. Kodak Vision3).' : '' })
  total += film

  // Light discipline (0–15)
  const lights = chips.light?.length ?? 0
  let lightScore = 0
  if (lights === 1) lightScore = 15
  else if (lights === 0 && LIGHT.test(text)) lightScore = 10
  else if (lights > 1) lightScore = 4
  else lightScore = 6
  breakdown.push({ key: 'light', label: 'Light (single source)', score: lightScore, max: 15, hint: lights > 1 ? 'Keep one light chip for coherence.' : '' })
  total += lightScore

  // Material / environment texture (0–10)
  const mat = MATERIAL.test(text) ? 10 : 4
  breakdown.push({ key: 'material', label: 'Material specificity', score: mat, max: 10, hint: mat < 8 ? 'Add env/texture chips or scene detail.' : '' })
  total += mat

  const overall = clamp(Math.round(total), 0, 100)
  return { overall, breakdown }
}
