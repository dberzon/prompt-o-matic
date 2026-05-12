import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  generateReferenceImageFromStage5,
  listEntityAnchors,
  setPrimaryEntityAnchor,
  uploadEntityReferenceAnchor,
  waitForPrimaryReferenceAnchor,
} from './entityAnchors.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('entity anchor api', () => {
  it('lists anchors for an entity', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, items: [] }),
    })))
    await listEntityAnchors('ent_1', { type: 'reference_image' })
    expect(fetch).toHaveBeenCalledWith(
      '/api/entities/ent_1/anchors?type=reference_image',
      expect.any(Object),
    )
  })

  it('posts set-primary for an anchor', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    })))
    await setPrimaryEntityAnchor('ent_1', 'anchor_1')
    expect(fetch).toHaveBeenCalledWith(
      '/api/entities/ent_1/anchors/anchor_1/set-primary',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('posts stage 5 reference generation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, stage: 5 }),
    })))
    await generateReferenceImageFromStage5('ent_1', { pollIntervalMs: 1 })
    expect(fetch).toHaveBeenCalledWith(
      '/api/entities/ent_1/extrapolate/stage/5',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('posts multipart upload for a reference anchor', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, item: { id: 'anchor_upload' } }),
    })))
    const file = new File(['png'], 'ref.png', { type: 'image/png' })
    await uploadEntityReferenceAnchor('ent_1', file)
    expect(fetch).toHaveBeenCalledWith(
      '/api/entities/ent_1/anchors',
      expect.objectContaining({ method: 'POST' }),
    )
    const formData = fetch.mock.calls[0][1].body
    expect(formData).toBeInstanceOf(FormData)
  })

  it('polls until a primary reference anchor appears', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1
      const items = calls < 2
        ? [{ id: 'a1', type: 'reference_image', isPrimary: false }]
        : [{ id: 'a2', type: 'reference_image', isPrimary: true }]
      return {
        ok: true,
        json: async () => ({ ok: true, items }),
      }
    }))
    const anchor = await waitForPrimaryReferenceAnchor('ent_1', {
      attempts: 3,
      intervalMs: 0,
      sleep: async () => {},
    })
    expect(anchor.id).toBe('a2')
    expect(calls).toBe(2)
  })
})
