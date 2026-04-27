const COLOR_FAMILY_RULES = [
  ['night-city cyan and orange, neon palette', 'drained earth tones, brown and pale beige, very low saturation'],
  ['deep saturated jewel tones, intentional color architecture', 'near-monochrome, color barely present'],
  ['black and white, crushed shadows, bright overcast sky', 'bold primary color accent against neutral ground, theatrical'],
]

const CONFLICT_CATEGORIES = {
  locationType: {
    id: 'location-type',
    groupIds: ['env'],
    cardinality: 1,
    severity: 'high',
    defaultFix: 'keep-primary',
  },
  palettePolarity: {
    id: 'palette-polarity',
    groupIds: ['color', 'texture'],
    cardinality: 1,
    severity: 'medium',
    defaultFix: 'keep-first-family',
  },
  realismMode: {
    id: 'realism-mode',
    groupIds: ['qual'],
    cardinality: 1,
    severity: 'medium',
    defaultFix: 'prefer-photoreal',
  },
  filmAesthetic: {
    id: 'film-aesthetic',
    groupIds: ['film'],
    cardinality: 1,
    severity: 'high',
    defaultFix: 'keep-first-film',
  },
  lightSource: {
    id: 'light-source',
    groupIds: ['light', 'texture', 'env'],
    cardinality: 1,
    severity: 'high',
    defaultFix: 'keep-first-light-source',
  },
}

const CHIP_TAGS = {
  // Environment chips
  'sprawling Edwardian mansion, dark wood and tall windows': {
    locationType: 'edwardian-mansion',
    regionStyle: 'british-period-interior',
    settingDomain: 'interior',
  },
  'Spanish Andalusian interior, tiled and saturated': {
    locationType: 'andalusian-interior',
    regionStyle: 'spanish-andalusian',
    settingDomain: 'interior',
  },
  'Italian piazza at noon, empty, strong shadows': {
    locationType: 'italian-piazza',
    regionStyle: 'italian-exterior',
    settingDomain: 'exterior',
  },
  'sparse Soviet-era interior, single window': {
    locationType: 'soviet-interior',
    regionStyle: 'eastern-european',
    settingDomain: 'interior',
  },
  'Greek island whitewashed alley, sea glare': {
    locationType: 'greek-island-alley',
    regionStyle: 'mediterranean-exterior',
    settingDomain: 'exterior',
  },
  'roadside diner, off-hours, no customers': {
    locationType: 'roadside-diner',
    regionStyle: 'americana-interior',
    settingDomain: 'interior',
  },
  'Finnish coastal tavern, peeling wood': {
    locationType: 'finnish-coastal-tavern',
    regionStyle: 'nordic-coastal-interior',
    settingDomain: 'interior',
  },
  'period interior, rough timber and stone, low ceiling': {
    locationType: 'period-timber-interior',
    settingDomain: 'interior',
  },
  'modernist concrete piazza, empty, strong shadows': {
    locationType: 'modernist-piazza',
    settingDomain: 'exterior',
  },

  // Texture chips with strong style/location implications
  'sun-bleached pastel walls, Italian exterior': {
    locationHint: 'italian-exterior',
    paletteFamily: 'sunbleached-pastel',
    saturation: 'medium',
  },
  'red-velvet interior depth, saturated fabric': {
    locationHint: 'ornate-interior',
    paletteFamily: 'velvet-red',
    saturation: 'high',
  },
  'dust suspended in shaft of light': {
    lightSourceKind: 'directional-beam',
  },
  'city lights reflected in wet asphalt': {
    lightSourceKind: 'neon-mixed',
  },

  // Palette chips
  'near-monochrome, color barely present': {
    paletteFamily: 'near-monochrome',
    saturation: 'low',
  },
  'deep saturated jewel tones, intentional color architecture': {
    paletteFamily: 'jewel-tones',
    saturation: 'high',
  },
  'drained earth tones, brown and pale beige, very low saturation': {
    paletteFamily: 'drained-earth',
    saturation: 'low',
  },
  'night-city cyan and orange, neon palette': {
    paletteFamily: 'cyan-orange-neon',
    saturation: 'high',
  },
  'black and white, crushed shadows, bright overcast sky': {
    paletteFamily: 'black-and-white',
    saturation: 'low',
  },
  'bold primary color accent against neutral ground, theatrical': {
    paletteFamily: 'bold-primary-accent',
    saturation: 'high',
  },
  'cool blue-gray, low contrast midtones': {
    paletteFamily: 'cool-blue-gray',
    saturation: 'low',
  },
  'teal shadow, amber highlight, split toned': {
    paletteFamily: 'teal-amber',
    saturation: 'medium',
  },
  'warm amber interior light against cold blue exterior': {
    paletteFamily: 'amber-vs-cold',
    saturation: 'medium',
  },

  // Film stock chips (traits: contrast, saturation)
  'shot on 35mm film, grain visible in flat areas': {
    filmStock: '35mm-generic',
    filmContrast: 'neutral',
    filmSaturation: 'neutral',
  },
  'Kodak Vision3 5219, rich shadows, neutral highlights': {
    filmStock: 'kodak-vision3-5219',
    filmContrast: 'low',
    filmSaturation: 'low',
  },
  'Fuji Eterna 500T, slightly cool, fine grain': {
    filmStock: 'fuji-eterna-500t',
    filmContrast: 'low',
    filmSaturation: 'low',
  },
  'Kodak Tri-X 400, coarse monochrome grain': {
    filmStock: 'kodak-tri-x-400',
    filmContrast: 'high',
    filmSaturation: 'mono',
  },
  '16mm film, coarse grain, slight softness in midtones': {
    filmStock: '16mm-generic',
    filmContrast: 'neutral',
    filmSaturation: 'neutral',
  },
  'Kodak Portra 400, warm neutral skintone': {
    filmStock: 'kodak-portra-400',
    filmContrast: 'low',
    filmSaturation: 'low',
  },
  'Kodachrome 25, saturated archival stock': {
    filmStock: 'kodachrome-25',
    filmContrast: 'high',
    filmSaturation: 'high',
  },
  'Ektachrome 100, cool clinical slide film': {
    filmStock: 'ektachrome-100',
    filmContrast: 'high',
    filmSaturation: 'high',
  },
  'Super 16 blown up, coarse modern grain': {
    filmStock: 'super-16',
    filmContrast: 'neutral',
    filmSaturation: 'neutral',
  },
  'digital Alexa 65 large format, smooth gradation': {
    filmStock: 'alexa-65-digital',
    filmContrast: 'low',
    filmSaturation: 'low',
  },
  'silver retention bleach bypass, inky shadows': {
    filmStock: 'bleach-bypass',
    filmContrast: 'high',
    filmSaturation: 'low',
  },
  'Fuji Velvia, punched saturation, landscape stock': {
    filmStock: 'fuji-velvia',
    filmContrast: 'high',
    filmSaturation: 'high',
  },

  // Light chips (lightSourceKind)
  'flat overcast light, uniform gray sky, no cast shadows': {
    lightSourceKind: 'overcast-ambient',
  },
  'low winter sun, oblique, long cold shadows': {
    lightSourceKind: 'directional-cold',
  },
  'fog-filtered diffused light, no direct source visible': {
    lightSourceKind: 'diffuse-ambient',
  },
  'contre-jour backlight, figures silhouetted, rim light on edges': {
    lightSourceKind: 'directional-backlight',
  },
  'single overhead institutional light, hard downward shadows': {
    lightSourceKind: 'hard-overhead',
  },
  'magic hour, golden light from below the cloud line': {
    lightSourceKind: 'directional-golden',
  },
  'neon and available light, night exterior': {
    lightSourceKind: 'neon-mixed',
  },
  'candlelight or fire, unstable warm pool': {
    lightSourceKind: 'warm-practical',
  },
  'overcast with one break in cloud, single beam of pale light on empty ground': {
    lightSourceKind: 'directional-beam',
  },
  'single practical lamp, warm pool in dark room': {
    lightSourceKind: 'warm-practical',
  },
  'screen or monitor light, cold blue-white glow on face': {
    lightSourceKind: 'cold-screen',
  },
  'late afternoon fading light, sky brighter than ground': {
    lightSourceKind: 'diffuse-ambient',
  },
  'harsh midday overhead sun, high contrast': {
    lightSourceKind: 'hard-overhead',
  },
  'sodium street lamp, amber monochrome cast': {
    lightSourceKind: 'warm-practical',
  },
  'chapel stained glass, colored patches on floor': {
    lightSourceKind: 'directional-beam',
  },
  'single fluorescent tube, cold green cast': {
    lightSourceKind: 'cold-fluorescent',
  },
  'firelight only, flickering warm shadow': {
    lightSourceKind: 'warm-practical',
  },
  'red neon wash, saturated pink-red on faces': {
    lightSourceKind: 'neon-mixed',
  },
  'tungsten interior warm, windows cold daylight': {
    lightSourceKind: 'mixed-temperature',
  },
  'dappled sunlight through leaves, broken patches': {
    lightSourceKind: 'directional-golden',
  },

  // Qualifier chips
  'photorealistic, not CGI, not illustrated': {
    realismMode: 'photoreal',
  },
  'analog photography, chemical film process': {
    realismMode: 'photoreal',
  },
  'dream logic, space does not obey physics': {
    realismMode: 'surreal',
  },
  'operatic staging, choreographed tableau': {
    realismMode: 'stylized',
  },
}

const CONFLICT_RULES = [
  {
    id: 'conflict-location-multi',
    category: 'locationType',
    when: {
      type: 'any-tags-distinct',
      tag: 'locationType',
      minDistinct: 2,
    },
    issue: {
      severity: 'high',
      message: 'Multiple primary locations selected. Choose one primary environment.',
      fixLabel: 'Keep first location',
    },
    fixStrategy: 'keep-first-by-tag',
    fixConfig: { tag: 'locationType' },
  },
  {
    id: 'conflict-setting-domain',
    category: 'locationType',
    when: {
      type: 'cross-tag-values',
      tag: 'settingDomain',
      values: ['interior', 'exterior'],
    },
    issue: {
      severity: 'high',
      message: 'Interior and exterior primary settings conflict in the same shot context.',
      fixLabel: 'Prefer first setting domain',
    },
    fixStrategy: 'keep-first-by-tag',
    fixConfig: { tag: 'settingDomain' },
  },
  {
    id: 'conflict-palette-saturation',
    category: 'palettePolarity',
    when: {
      type: 'cross-tag-values',
      tag: 'saturation',
      values: ['low', 'high'],
    },
    issue: {
      severity: 'medium',
      message: 'Palette instructions conflict between low saturation and highly saturated styles.',
      fixLabel: 'Keep first palette family',
    },
    fixStrategy: 'keep-first-by-tag',
    fixConfig: { tag: 'paletteFamily' },
  },
  {
    id: 'conflict-realism-mode',
    category: 'realismMode',
    when: {
      type: 'cross-tag-values',
      tag: 'realismMode',
      values: ['photoreal', 'surreal'],
    },
    issue: {
      severity: 'medium',
      message: 'Photoreal and surreal mode are both active; image intent becomes unstable.',
      fixLabel: 'Prefer photoreal mode',
    },
    fixStrategy: 'prefer-tag-value',
    fixConfig: { tag: 'realismMode', preferred: 'photoreal' },
  },
  {
    id: 'conflict-film-saturation',
    category: 'filmAesthetic',
    when: {
      type: 'cross-tag-values',
      tag: 'filmSaturation',
      values: ['high', 'low'],
    },
    issue: {
      severity: 'high',
      message: 'Film stocks with opposing saturation profiles selected (e.g., Kodachrome high-saturation vs Vision3 low-saturation).',
      fixLabel: 'Keep first film stock',
    },
    fixStrategy: 'keep-first-by-tag',
    fixConfig: { tag: 'filmStock' },
  },
  {
    id: 'conflict-film-contrast',
    category: 'filmAesthetic',
    when: {
      type: 'cross-tag-values',
      tag: 'filmContrast',
      values: ['high', 'low'],
    },
    issue: {
      severity: 'medium',
      message: 'Film stocks with opposing contrast profiles selected (high-contrast stock vs low-contrast stock).',
      fixLabel: 'Keep first film stock',
    },
    fixStrategy: 'keep-first-by-tag',
    fixConfig: { tag: 'filmStock' },
  },
  {
    id: 'conflict-light-source-multi',
    category: 'lightSource',
    when: {
      type: 'any-tags-distinct',
      tag: 'lightSourceKind',
      minDistinct: 2,
    },
    issue: {
      severity: 'high',
      message: 'Multiple light-source kinds implied across chips (e.g., practical lamp + directional beam). Pick one dominant light source.',
      fixLabel: 'Keep first light source',
    },
    fixStrategy: 'keep-first-by-tag',
    fixConfig: { tag: 'lightSourceKind' },
  },
]

const CONFLICT_RULE_MAP = Object.fromEntries(CONFLICT_RULES.map((rule) => [rule.id, rule]))

function hasAntiCgiQualifier(quals = []) {
  const haystack = quals.join(' ').toLowerCase()
  return (
    haystack.includes('not cgi') ||
    haystack.includes('photorealistic') ||
    haystack.includes('analog photography')
  )
}

function flattenChipSelections(chips = {}) {
  const rows = []
  for (const [groupId, values] of Object.entries(chips)) {
    if (!Array.isArray(values)) continue
    for (const value of values) {
      const tags = CHIP_TAGS[value]
      rows.push({ groupId, value, tags: tags ?? null })
    }
  }
  return rows
}

function distinctTagValues(selections = [], tag) {
  const vals = selections
    .map((row) => row.tags?.[tag])
    .filter((value) => typeof value !== 'undefined')
  return new Set(vals)
}

function ruleMatches(rule, selections) {
  if (!rule?.when?.type) return false
  if (rule.when.type === 'any-tags-distinct') {
    const distinct = distinctTagValues(selections, rule.when.tag)
    return distinct.size >= (rule.when.minDistinct ?? 2)
  }
  if (rule.when.type === 'cross-tag-values') {
    const distinct = distinctTagValues(selections, rule.when.tag)
    return (rule.when.values ?? []).every((val) => distinct.has(val))
  }
  return false
}

function pruneEmptyGroups(chips = {}) {
  const next = {}
  for (const [groupId, values] of Object.entries(chips)) {
    if (Array.isArray(values) && values.length > 0) next[groupId] = values
  }
  return next
}

function applyKeepFirstByTag(chips = {}, tag) {
  const selections = flattenChipSelections(chips).filter((row) => typeof row.tags?.[tag] !== 'undefined')
  if (selections.length <= 1) return chips

  const keeper = selections[0].tags[tag]
  const next = {}
  for (const [groupId, values] of Object.entries(chips)) {
    if (!Array.isArray(values)) continue
    next[groupId] = values.filter((value) => {
      const tagValue = CHIP_TAGS[value]?.[tag]
      if (typeof tagValue === 'undefined') return true
      return tagValue === keeper
    })
  }
  return pruneEmptyGroups(next)
}

function applyPreferTagValue(chips = {}, tag, preferred) {
  const selections = flattenChipSelections(chips).filter((row) => typeof row.tags?.[tag] !== 'undefined')
  if (selections.length <= 1) return chips

  const hasPreferred = selections.some((row) => row.tags?.[tag] === preferred)
  if (!hasPreferred) return applyKeepFirstByTag(chips, tag)

  const next = {}
  for (const [groupId, values] of Object.entries(chips)) {
    if (!Array.isArray(values)) continue
    next[groupId] = values.filter((value) => {
      const tagValue = CHIP_TAGS[value]?.[tag]
      if (typeof tagValue === 'undefined') return true
      return tagValue === preferred
    })
  }
  return pruneEmptyGroups(next)
}

export function validatePromptRules({ chips = {}, hasContent = false, maxLens = 2 }) {
  const issues = []

  const light = chips.light ?? []
  if (light.length > 1) {
    issues.push({
      id: 'multiple-light',
      severity: 'high',
      message: 'More than one light chip selected; this can break photographic coherence.',
      fixLabel: 'Keep first light',
    })
  }

  const color = chips.color ?? []
  for (const [a, b] of COLOR_FAMILY_RULES) {
    if (color.includes(a) && color.includes(b)) {
      issues.push({
        id: 'color-conflict',
        severity: 'medium',
        message: 'Selected color chips pull in conflicting directions.',
        fixLabel: 'Keep first palette',
      })
      break
    }
  }

  const lens = chips.lens ?? []
  if (lens.length > maxLens) {
    issues.push({
      id: 'lens-overflow',
      severity: 'low',
      message: `Lens stack is heavy (${lens.length}); consider limiting to ${maxLens}.`,
      fixLabel: `Trim to ${maxLens}`,
    })
  }

  const film = chips.film ?? []
  if (film.length > 1) {
    issues.push({
      id: 'film-overflow',
      severity: 'high',
      message: `Multiple film stocks selected (${film.length}); keep a single stock for a coherent grade.`,
      fixLabel: 'Keep first film',
    })
  }

  if (hasContent && !hasAntiCgiQualifier(chips.qual ?? [])) {
    issues.push({
      id: 'missing-anti-cgi',
      severity: 'medium',
      message: 'No anti-CGI qualifier selected.',
      fixLabel: 'Add anti-CGI qualifier',
    })
  }

  const selections = flattenChipSelections(chips)
  for (const rule of CONFLICT_RULES) {
    if (!CONFLICT_CATEGORIES[rule.category]) continue
    if (!ruleMatches(rule, selections)) continue
    issues.push({
      id: rule.id,
      severity: rule.issue.severity,
      message: rule.issue.message,
      fixLabel: rule.issue.fixLabel,
    })
  }

  return issues
}

export function applyRuleFix(chips = {}, issueId, maxLens = 2) {
  let next = { ...chips }

  if (issueId === 'multiple-light' && Array.isArray(next.light) && next.light.length > 1) {
    next.light = [next.light[0]]
  }

  if (issueId === 'color-conflict' && Array.isArray(next.color) && next.color.length > 1) {
    next.color = [next.color[0]]
  }

  if (issueId === 'lens-overflow' && Array.isArray(next.lens) && next.lens.length > maxLens) {
    next.lens = next.lens.slice(0, maxLens)
  }

  if (issueId === 'film-overflow' && Array.isArray(next.film) && next.film.length > 1) {
    next.film = [next.film[0]]
  }

  if (issueId === 'missing-anti-cgi') {
    const qual = new Set(next.qual ?? [])
    qual.add('photorealistic, not CGI, not illustrated')
    next.qual = [...qual]
  }

  const conflictRule = CONFLICT_RULE_MAP[issueId]
  if (conflictRule?.fixStrategy === 'keep-first-by-tag') {
    next = applyKeepFirstByTag(next, conflictRule.fixConfig?.tag)
  }
  if (conflictRule?.fixStrategy === 'prefer-tag-value') {
    next = applyPreferTagValue(next, conflictRule.fixConfig?.tag, conflictRule.fixConfig?.preferred)
  }

  return next
}
