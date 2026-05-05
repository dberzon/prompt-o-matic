import { describe, expect, it } from 'vitest'
import { allLegacyItemsMigrated, mergeRemoteWithLegacyById } from './promptStorage.js'

describe('prompt storage migration helpers', () => {
  it('keeps legacy-only entries visible after a partial migration', () => {
    const remote = [{ id: 'prompt-1', name: 'Saved remotely' }]
    const legacy = [
      { id: 'prompt-1', name: 'Saved remotely' },
      { id: 'prompt-2', name: 'Still only in localStorage' },
    ]

    expect(mergeRemoteWithLegacyById(remote, legacy)).toEqual([
      { id: 'prompt-1', name: 'Saved remotely' },
      { id: 'prompt-2', name: 'Still only in localStorage' },
    ])
    expect(allLegacyItemsMigrated(remote, legacy)).toBe(false)
  })

  it('confirms migration only when every legacy id exists remotely', () => {
    const legacy = [{ id: 'profile-1' }, { id: 'profile-2' }]
    const remote = [{ id: 'profile-2' }, { id: 'profile-1' }]

    expect(allLegacyItemsMigrated(remote, legacy)).toBe(true)
  })
})
