import { describe, expect, it } from 'vitest'
import { assemblePrompt, dedupeFragments } from './assembler.js'

describe('dedupeFragments', () => {
  it('removes exact duplicates while preserving order', () => {
    const input = [
      'photorealistic, not CGI, not illustrated',
      'cool blue-gray, low contrast midtones',
      'photorealistic, not CGI, not illustrated',
    ]

    expect(dedupeFragments(input)).toEqual([
      'photorealistic, not CGI, not illustrated',
      'cool blue-gray, low contrast midtones',
    ])
  })

  it('removes near duplicates when one qualifier contains the other', () => {
    const input = [
      'photorealistic, not CGI, not illustrated',
      'photorealistic, analog photography, not CGI, not illustrated',
    ]

    expect(dedupeFragments(input)).toEqual([
      'photorealistic, not CGI, not illustrated',
    ])
  })

  it('keeps distinct fragments that share only a subset of tokens', () => {
    const input = [
      'single practical lamp, warm pool in dark room',
      'dust suspended in shaft of light',
      'cool blue-gray, low contrast midtones',
    ]

    expect(dedupeFragments(input)).toEqual(input)
  })
})

describe('assemblePrompt', () => {
  it('dedupes assembled fragments before returning output', () => {
    const result = assemblePrompt({
      scene: '',
      scenario: 'two people facing camera',
      chips: {
        qual: [
          'photorealistic, not CGI, not illustrated',
          'photorealistic, analog photography, not CGI, not illustrated',
        ],
      },
    })

    expect(result).toContain('two people facing camera')
    expect(result.filter((part) => part.includes('photorealistic')).length).toBe(1)
  })

  it('keeps semantically different defaults/chips instead of over-deduping', () => {
    const result = assemblePrompt({
      scene: '',
      scenario: 'quiet portrait at dusk',
      chips: {
        color: [
          'cool blue-gray, low contrast midtones',
          'warm amber interior light against cold blue exterior',
        ],
        qual: ['photorealistic, not CGI, not illustrated'],
      },
    })

    expect(result).toContain('cool blue-gray, low contrast midtones')
    expect(result).toContain('warm amber interior light against cold blue exterior')
  })
})
