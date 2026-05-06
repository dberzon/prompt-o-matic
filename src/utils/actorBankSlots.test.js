import { describe, expect, it } from 'vitest'
import { hydrateActorBankSlots } from './actorBankSlots.js'

describe('hydrateActorBankSlots', () => {
  const bankChars = [
    {
      id: 'char-1',
      name: 'Lena Sholk',
      promptDescriptor: 'wiry botanist with a weathered field jacket',
      thumbnailUrl: '/generated/lena.png',
    },
  ]

  it('fills blank linked fields from the bank and settles on the next pass', () => {
    const slots = [
      {
        actorBankId: 'char-1',
        name: '',
        promptDescriptor: '',
        thumbnailUrl: '',
        g: 'woman',
        a: '40s',
      },
    ]

    const hydrated = hydrateActorBankSlots(slots, bankChars)

    expect(hydrated).toEqual([
      {
        actorBankId: 'char-1',
        name: 'Lena Sholk',
        promptDescriptor: 'wiry botanist with a weathered field jacket',
        thumbnailUrl: '/generated/lena.png',
        g: 'woman',
        a: '40s',
      },
    ])
    expect(hydrateActorBankSlots(hydrated, bankChars)).toBe(hydrated)
  })

  it('returns the original slots when linked fields are already hydrated', () => {
    const slots = [
      {
        actorBankId: 'char-1',
        name: 'Lena Sholk',
        promptDescriptor: 'wiry botanist with a weathered field jacket',
        thumbnailUrl: '/generated/lena.png',
        g: 'woman',
        a: '40s',
      },
    ]

    expect(hydrateActorBankSlots(slots, bankChars)).toBe(slots)
  })
})
