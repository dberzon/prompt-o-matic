/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import BibleStepContainer from './BibleStepContainer.jsx'

vi.mock('../features/bible/BibleEditor.jsx', () => ({
  default: ({ entityId }) => (
    <div data-testid="mock-bible-editor">BibleEditor {entityId}</div>
  ),
}))

vi.mock('./VisualAnchorPicker.jsx', () => ({
  default: ({ entityId }) => (
    <div data-testid="mock-visual-anchor">VisualAnchorPicker {entityId}</div>
  ),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const baseProps = {
  activeCharId: null,
  activeEntityId: null,
  setActiveEntityId: vi.fn(),
  activeBankSlug: null,
  setActiveStep: vi.fn(),
  onNext: vi.fn(),
  onPrev: vi.fn(),
}

describe('BibleStepContainer', () => {
  it('shows empty state when activeCharId is null', () => {
    render(<BibleStepContainer {...baseProps} />)
    expect(screen.getByText(/select a character in step 1 first/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /go to casting/i }))
    expect(baseProps.setActiveStep).toHaveBeenCalledWith(1)
  })

  it('shows Lift CTA when char is set but entity is null', () => {
    render(
      <BibleStepContainer
        {...baseProps}
        activeCharId="char_1"
        activeBankSlug="bank_slug_1"
      />,
    )
    expect(screen.getByRole('button', { name: /lift to bible context/i })).toBeTruthy()
    expect(screen.queryByTestId('mock-bible-editor')).toBeNull()
  })

  it('POSTs lift-from-bank-entry with canonical bank slug and sets entity id on success', async () => {
    const setActiveEntityId = vi.fn()
    const fetchMock = vi.fn(async (url, init) => {
      const u = String(url)
      if (u.includes('/api/characters?id=')) {
        return {
          ok: true,
          json: async () => ({ item: { name: 'Test Actor', slug: 'canonical_slug', description: 'Raw desc' } }),
        }
      }
      if (u.includes('/api/entities/lift-from-bank-entry')) {
        const body = JSON.parse(init.body)
        expect(body.slug).toBe('canonical_slug')
        return {
          ok: true,
          json: async () => ({ ok: true, entity: { id: 'ent_lifted' } }),
        }
      }
      return { ok: false, json: async () => ({ error: 'unexpected' }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <BibleStepContainer
        {...baseProps}
        activeCharId="char_1"
        activeBankSlug="bank_slug_1"
        setActiveEntityId={setActiveEntityId}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /lift to bible context/i }))

    await waitFor(() => {
      expect(screen.getByText(/lifting/i)).toBeTruthy()
    })

    await waitFor(() => {
      expect(setActiveEntityId).toHaveBeenCalledTimes(1)
      expect(setActiveEntityId).toHaveBeenCalledWith('ent_lifted')
    })

    const liftCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/api/entities/lift-from-bank-entry'),
    )
    expect(liftCall).toBeTruthy()
    expect(liftCall[1].method).toBe('POST')
    expect(setActiveEntityId).toHaveBeenCalledTimes(1)
  })

  it('renders BibleEditor and VisualAnchorPicker when activeEntityId is set', () => {
    render(
      <BibleStepContainer
        {...baseProps}
        activeCharId="char_1"
        activeEntityId="ent_loaded"
      />,
    )
    expect(screen.getByTestId('mock-bible-editor').textContent).toContain('ent_loaded')
    expect(screen.getByTestId('mock-visual-anchor').textContent).toContain('ent_loaded')
    expect(screen.queryByRole('button', { name: /lift to bible context/i })).toBeNull()
  })
})
