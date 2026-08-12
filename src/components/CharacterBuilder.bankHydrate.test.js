/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import {
  isBankHydrateCurrent,
  mergeBankEntriesIntoCharacters,
} from './characterBuilderBankHydrate.js'

describe('CharacterBuilder bank hydrate', () => {
  it('mergeBankEntriesIntoCharacters overwrites matching slugs from bank rows', () => {
    const prev = {
      alice: {
        slug: 'alice',
        name: 'Alice',
        rawDescription: 'local alice',
        optimizedDescription: 'opt',
        createdAt: 1,
      },
      local_only: {
        slug: 'local_only',
        name: 'Local',
        rawDescription: 'only local',
        optimizedDescription: '',
        createdAt: 2,
      },
    }
    const merged = mergeBankEntriesIntoCharacters(prev, [
      {
        slug: 'alice',
        name: 'Alice Bank',
        description: 'stale bank alice',
        optimizedDescription: 'bank opt',
        createdAt: '2020-01-01T00:00:00.000Z',
      },
    ])
    expect(merged.alice.rawDescription).toBe('stale bank alice')
    expect(merged.alice.name).toBe('Alice Bank')
    expect(merged.local_only.rawDescription).toBe('only local')
  })

  it('isBankHydrateCurrent rejects cancelled or superseded hydrate generations', () => {
    expect(isBankHydrateCurrent(1, 1, false)).toBe(true)
    expect(isBankHydrateCurrent(1, 2, false)).toBe(false)
    expect(isBankHydrateCurrent(1, 1, true)).toBe(false)
  })
})
