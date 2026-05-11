import { afterEach, describe, expect, it, vi } from 'vitest'
import { dismissEntityConflict, resolveEntityConflict } from './entityConflicts.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('entity conflict api', () => {
  it('resolves a conflict with a winning attribute', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, winningAttributeId: 'attr_1' }),
    })))
    await resolveEntityConflict('ent_1', 'conflict_1', 'attr_1')
    expect(fetch).toHaveBeenCalledWith(
      '/api/entities/ent_1/conflicts/conflict_1/resolve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ winningAttributeId: 'attr_1' }),
      }),
    )
  })

  it('dismisses a conflict marker', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    })))
    await dismissEntityConflict('ent_1', 'conflict_1')
    expect(fetch).toHaveBeenCalledWith(
      '/api/entities/ent_1/conflicts/conflict_1/dismiss',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
