/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import AttributeReviewPanel from './AttributeReviewPanel.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AttributeReviewPanel', () => {
  it('renders inferred attributes from multiple numeric stages', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'attr_s3',
            key: 'behavior.tone',
            value: 'quiet',
            provenance: 'inferred',
            confidence: 0.7,
            sourceStage: 3,
          },
          {
            id: 'attr_s2',
            key: 'history.event',
            value: '1947',
            provenance: 'inferred',
            confidence: 0.5,
            sourceStage: 2,
          },
          {
            id: 'attr_s10',
            key: 'speech.pace',
            value: 'slow',
            provenance: 'suggested',
            confidence: null,
            sourceStage: 10,
          },
        ],
      }),
    })))

    render(<AttributeReviewPanel entityId="ent_ruslan" />)

    await waitFor(() => {
      expect(screen.getByText('history.event')).toBeTruthy()
    })
    expect(screen.getByText('behavior.tone')).toBeTruthy()
    expect(screen.getByText('speech.pace')).toBeTruthy()

    const stages = screen.getAllByText(/^Stage /).map((node) => node.textContent)
    expect(stages).toEqual(['Stage 2', 'Stage 3', 'Stage 10'])
  })
})
