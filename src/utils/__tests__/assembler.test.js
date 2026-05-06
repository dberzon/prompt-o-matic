import { describe, it, expect } from 'vitest'
import { assemblePrompt, dedupeFragments, rewriteScene, getCharDesc } from '../assembler.js'
import { REWRITES, DEFAULTS } from '../../data/constants.js'

// ── dedupeFragments ──────────────────────────────────────────────────────────

describe('dedupeFragments', () => {
  it('removes exact duplicates', () => {
    expect(dedupeFragments(['a', 'a', 'b'])).toEqual(['a', 'b'])
  })

  it('removes near-exact duplicates by Jaccard similarity', () => {
    const result = dedupeFragments(['flat overcast light', 'flat overcast light, uniform gray sky'])
    expect(result).toHaveLength(1)
  })

  it('keeps fragments that are genuinely different', () => {
    expect(dedupeFragments(['35mm natural lens', 'neon and available light'])).toHaveLength(2)
  })

  it('removes empty and whitespace-only entries', () => {
    expect(dedupeFragments(['', '  ', 'valid'])).toEqual(['valid'])
  })

  it('keeps first occurrence when near-duplicate found', () => {
    const result = dedupeFragments(['first thing here', 'first thing here again'])
    expect(result[0]).toBe('first thing here')
  })

  it('substring near-duplicate: removes shorter if contained in longer (>=24 chars)', () => {
    const long = 'eastern European village outskirts, low rendered-brick houses'
    const short = 'eastern European village outskirts'
    expect(dedupeFragments([long, short])).toHaveLength(1)
  })
})

// ── REWRITES (each trigger independently) ───────────────────────────────────

describe('REWRITES — each pattern triggers', () => {
  const cases = [
    ['eastern european village', 'eastern European village outskirts'],
    ['coal mine', 'coal mine headframe'],
    ['apartment block', 'prefabricated concrete apartment block'],
    ['train station', 'train station, empty platform'],
    ['forest', 'stand of bare deciduous trees'],
    ['field', 'field of dead grass'],
    ['road', 'unpaved road'],
    ['late autumn', 'late autumn, leaves gone'],
    ['early spring', 'early spring, ground thawing'],
    ['winter', 'late winter'],
    ['rain', 'fine persistent rain'],
    ['fog', 'low fog'],
    ['snow', 'thin snow cover'],
    ['gray raincoat', 'gray wool raincoat'],
    ['overcoat', 'heavy wool overcoat'],
    ['suit', 'dark suit'],
    ['uniform', 'utilitarian uniform'],
    ['dress', 'simple dress'],
    ['lying down', 'lying on one side'],
    ['sitting', 'seated, weight forward'],
    ['standing', 'standing still, weight on one foot'],
    ['walking', 'walking at unhurried pace'],
    ['leaning', 'leaning against the wall'],
    ['crouching', 'crouched low'],
    ['kneeling', 'kneeling on one knee'],
    ['slumped', 'slumped, upper body collapsed forward'],
  ]

  it(`covers all ${REWRITES.length} REWRITES entries`, () => {
    expect(cases.length).toBe(REWRITES.length)
  })

  for (const [input, expectedSubstring] of cases) {
    it(`"${input}" → contains "${expectedSubstring}"`, () => {
      const result = rewriteScene(input)
      expect(result.toLowerCase()).toContain(expectedSubstring.toLowerCase())
    })
  }
})

// ── rewriteScene ─────────────────────────────────────────────────────────────

describe('rewriteScene', () => {
  it('returns empty string for blank input', () => {
    expect(rewriteScene('')).toBe('')
    expect(rewriteScene('   ')).toBe('')
  })

  it('strips trailing period', () => {
    expect(rewriteScene('a quiet room.')).not.toMatch(/\.$/)
  })

  it('expands @slug tokens', () => {
    const characters = { aria: { optimizedDescription: 'elegant woman in white coat' } }
    expect(rewriteScene('@aria walks', characters)).toContain('elegant woman in white coat')
  })

  it('leaves unresolved @slug tokens intact', () => {
    expect(rewriteScene('@unknown_person sits')).toContain('@unknown_person')
  })

  it('slug resolves kebab-case from snake_case entry', () => {
    const characters = { aria_chen: { optimizedDescription: 'the detective' } }
    expect(rewriteScene('@aria-chen in the rain', characters)).toContain('the detective')
  })

  it('cascade: "sitting" triggers REWRITE #20 which does not re-trigger other rewrites', () => {
    const result = rewriteScene('sitting')
    expect(result).toContain('seated')
    expect(result).not.toContain('seated, weight forward, elbows on knees, weight forward')
  })
})

// ── assemblePrompt — fragment order ─────────────────────────────────────────

describe('assemblePrompt — fragment order', () => {
  it('produces shot, lens, scenario, scene, light, color, film, qual in order', () => {
    const chips = {
      shot: ['wide establishing shot'],
      lens: ['35mm natural lens'],
      light: ['golden hour side light'],
      color: ['warm amber palette'],
      film: ['Kodak 5207'],
      qual: ['photorealistic'],
    }
    const parts = assemblePrompt({ scene: 'field', scenario: 'two men talk', chips })
    const str = parts.join(', ')
    const shotIdx = str.indexOf('wide establishing shot')
    const lensIdx = str.indexOf('35mm natural lens')
    const scenarioIdx = str.indexOf('two men talk')
    const lightIdx = str.indexOf('golden hour side light')

    expect(shotIdx).toBeLessThan(lensIdx)
    expect(lensIdx).toBeLessThan(scenarioIdx)
    expect(scenarioIdx).toBeLessThan(lightIdx)
  })

  it('scenario appears before scene text', () => {
    const parts = assemblePrompt({ scene: 'a forest', scenario: 'the inspector arrives', chips: {} })
    const str = parts.join(', ')
    expect(str.indexOf('the inspector arrives')).toBeLessThan(str.indexOf('stand of bare deciduous'))
  })
})

// ── assemblePrompt — defaults ────────────────────────────────────────────────

describe('assemblePrompt — defaults applied when hasMeat', () => {
  it('injects default shot when scene or scenario present', () => {
    const parts = assemblePrompt({ scene: 'rain', scenario: '', chips: {} })
    expect(parts).toContain(DEFAULTS.shot)
  })

  it('injects default light when no light chip', () => {
    const parts = assemblePrompt({ scene: 'fog', scenario: '', chips: {} })
    expect(parts.join(' ')).toContain('overcast')
  })

  it('injects default color when no color chip', () => {
    const parts = assemblePrompt({ scene: 'road', scenario: '', chips: {} })
    expect(parts.join(' ')).toContain('muted desaturated')
  })

  it('injects default film when no film chip', () => {
    const parts = assemblePrompt({ scene: 'fog', scenario: '', chips: {} })
    expect(parts.join(' ')).toContain('35mm film')
  })

  it('injects default qual when no qual chip', () => {
    const parts = assemblePrompt({ scene: 'fog', scenario: '', chips: {} })
    expect(parts.join(' ')).toContain('photorealistic')
  })
})

// ── assemblePrompt — edge cases ──────────────────────────────────────────────

describe('assemblePrompt — edge cases', () => {
  it('empty scene and scenario: no defaults injected', () => {
    const parts = assemblePrompt({ scene: '', scenario: '', chips: {} })
    expect(parts).toEqual([])
  })

  it('all chips provided, no defaults added', () => {
    const chips = {
      shot: ['extreme close-up'],
      lens: ['telephoto 85mm'],
      light: ['neon and available light'],
      color: ['monochrome'],
      film: ['Fujifilm Provia'],
      qual: ['editorial photography'],
    }
    const parts = assemblePrompt({ scene: 'rain', scenario: '', chips })
    const str = parts.join(', ')
    expect(str).not.toContain(DEFAULTS.light)
    expect(str).not.toContain(DEFAULTS.color)
    expect(str).not.toContain(DEFAULTS.film)
    expect(str).not.toContain(DEFAULTS.qual)
  })

  it('env and texture chips appear between scene and light', () => {
    const chips = {
      env: ['flooded ruins'],
      texture: ['peeling paint'],
      light: ['flat overcast light'],
    }
    const parts = assemblePrompt({ scene: 'standing', scenario: '', chips })
    const str = parts.join(', ')
    const envIdx = str.indexOf('flooded ruins')
    const texIdx = str.indexOf('peeling paint')
    const lightIdx = str.indexOf('flat overcast light')
    expect(envIdx).toBeLessThan(lightIdx)
    expect(texIdx).toBeLessThan(lightIdx)
  })

  it('comp chips appear after env/texture, before light', () => {
    const chips = {
      env: ['empty room'],
      comp: ['rule of thirds, subject off-center'],
      light: ['single overhead light'],
    }
    const parts = assemblePrompt({ scene: 'standing', scenario: '', chips })
    const str = parts.join(', ')
    const envIdx = str.indexOf('empty room')
    const compIdx = str.indexOf('rule of thirds')
    const lightIdx = str.indexOf('single overhead light')
    expect(envIdx).toBeLessThan(compIdx)
    expect(compIdx).toBeLessThan(lightIdx)
  })

  it('no director or scenario: prompt still assembles from scene alone', () => {
    const parts = assemblePrompt({ scene: 'fog', scenario: '', chips: {} })
    expect(parts.length).toBeGreaterThan(0)
    expect(parts.join(' ')).toContain('fog')
  })

  it('multiple lens chips all included', () => {
    const chips = { lens: ['35mm natural lens', 'deep focus, everything sharp'] }
    const parts = assemblePrompt({ scene: 'rain', scenario: '', chips })
    const str = parts.join(', ')
    expect(str).toContain('35mm natural lens')
    expect(str).toContain('deep focus, everything sharp')
  })
})

// ── assemblePrompt — deduplication ──────────────────────────────────────────

describe('assemblePrompt — deduplication', () => {
  it('exact duplicate chip value deduplicated', () => {
    const chips = {
      shot: ['wide establishing shot'],
      lens: ['wide establishing shot'],
    }
    const parts = assemblePrompt({ scene: '', scenario: 'test', chips })
    const count = parts.filter((p) => p === 'wide establishing shot').length
    expect(count).toBe(1)
  })

  it('near-duplicate chip values deduplicated', () => {
    const chips = {
      light: ['flat overcast light, uniform gray sky, no cast shadows'],
      qual: ['flat overcast light'],
    }
    const parts = assemblePrompt({ scene: 'fog', scenario: '', chips })
    const occurrences = parts.filter((p) => p.toLowerCase().includes('flat overcast')).length
    expect(occurrences).toBe(1)
  })

  it('default light not added if already in qual chip (overlap)', () => {
    const chips = {
      qual: ['flat overcast light uniform gray sky no cast shadows photorealistic'],
    }
    const parts = assemblePrompt({ scene: 'fog', scenario: '', chips })
    const lightOccurrences = parts.filter((p) => p.toLowerCase().includes('flat overcast')).length
    expect(lightOccurrences).toBeLessThanOrEqual(1)
  })
})

// ── getCharDesc ──────────────────────────────────────────────────────────────

describe('getCharDesc', () => {
  const genders = ['man', 'woman', 'person']
  const ages = ['child', 'teen', '20s', '30s', '40s', '50s', '60s', 'elderly']

  for (const gender of genders) {
    for (const age of ages) {
      it(`getCharDesc(${gender}, ${age}) returns a non-empty string`, () => {
        const result = getCharDesc(gender, age)
        expect(typeof result).toBe('string')
        expect(result.length).toBeGreaterThan(0)
      })
    }
  }

  it('unknown gender/age returns fallback "gender, age"', () => {
    expect(getCharDesc('alien', 'ageless')).toBe('alien, ageless')
  })
})
