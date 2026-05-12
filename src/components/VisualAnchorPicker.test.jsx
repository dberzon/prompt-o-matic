/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VisualAnchorPicker from './VisualAnchorPicker.jsx'
import * as entityAnchors from '../lib/api/entityAnchors.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('VisualAnchorPicker upload override', () => {
  it('uploads a dropped image through the anchor multipart API', async () => {
    vi.spyOn(entityAnchors, 'listEntityAnchors').mockResolvedValue({ items: [] })
    const upload = vi.spyOn(entityAnchors, 'uploadEntityReferenceAnchor').mockResolvedValue({
      ok: true,
      item: { id: 'anchor_upload' },
    })

    render(<VisualAnchorPicker entityId="ent_1" />)

    const dropZone = await screen.findByTestId('T_C_REFGEN_UPLOAD')
    const file = new File(['png'], 'ref.png', { type: 'image/png' })
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(upload).toHaveBeenCalledWith('ent_1', file)
    })
  })

  it('uploads a browsed image through the anchor multipart API', async () => {
    vi.spyOn(entityAnchors, 'listEntityAnchors').mockResolvedValue({ items: [] })
    const upload = vi.spyOn(entityAnchors, 'uploadEntityReferenceAnchor').mockResolvedValue({
      ok: true,
      item: { id: 'anchor_upload' },
    })

    render(<VisualAnchorPicker entityId="ent_1" />)

    const input = await screen.findByTestId('T_F_ANCHOR_UPLOAD')
    const file = new File(['png'], 'ref.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(upload).toHaveBeenCalledWith('ent_1', file)
    })
  })
})
