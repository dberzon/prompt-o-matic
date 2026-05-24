/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ActorBankView from './ActorBankView.jsx'

function jsonResponse(body, ok = true) {
  return {
    ok,
    json: async () => body,
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ActorBankView', () => {
  it('notifies the workflow when a bank character is selected', async () => {
    const onWorkflowCharacterSelect = vi.fn()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const href = String(url)
      if (href.includes('?id=char_actor')) {
        return jsonResponse({
          ok: true,
          item: {
            id: 'char_actor',
            name: 'Rita',
            images: [],
          },
        })
      }
      return jsonResponse({
        ok: true,
        items: [{
          id: 'char_actor',
          name: 'Rita',
          age: 34,
          genderPresentation: 'Female',
          imageCount: 0,
        }],
        total: 1,
      })
    })

    render(<ActorBankView onWorkflowCharacterSelect={onWorkflowCharacterSelect} />)

    fireEvent.click(await screen.findByRole('button', { name: /Rita/i }))

    await waitFor(() => {
      expect(onWorkflowCharacterSelect).toHaveBeenCalledWith({
        charId: 'char_actor',
        bankSlug: null,
        entityId: null,
        source: 'actor-bank',
      })
    })
  })
})
