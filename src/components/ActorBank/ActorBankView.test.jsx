/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ActorBankView from './ActorBankView.jsx'

const CHAR_ID = 'char_test_1'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function stubCharactersFetch() {
  const fetchMock = vi.fn(async (url) => {
    const u = String(url)
    if (u.includes('/api/characters?id=')) {
      return {
        ok: true,
        json: async () => ({
          item: { id: CHAR_ID, name: 'Test Actor', images: [] },
        }),
      }
    }
    if (u.includes('/api/characters')) {
      return {
        ok: true,
        json: async () => ({
          items: [{ id: CHAR_ID, name: 'Test Actor' }],
          total: 1,
        }),
      }
    }
    return { ok: false, json: async () => ({ error: 'unexpected' }) }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('ActorBankView', () => {
  it('Open in Casting Room reports the selected character', async () => {
    stubCharactersFetch()
    const onOpenInCastingRoom = vi.fn()

    render(
      <ActorBankView
        onOpenInCastingRoom={onOpenInCastingRoom}
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test actor/i })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /test actor/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open in casting room/i })).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /open in casting room/i }))
    })

    expect(onOpenInCastingRoom).toHaveBeenCalledTimes(1)
    expect(onOpenInCastingRoom).toHaveBeenCalledWith(CHAR_ID)
  })
})
