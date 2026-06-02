/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ActorBankView from './ActorBankView.jsx'

const CHAR_ID = 'char_test_1'
const CHAR_SLUG = 'test_actor_slug'

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
          item: { id: CHAR_ID, slug: CHAR_SLUG, name: 'Test Actor', images: [] },
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
  it('Open in Casting Room relays the character id and bank slug before switching tabs', async () => {
    const fetchMock = stubCharactersFetch()
    const onWorkflowCharacterSelect = vi.fn()
    const setActiveStep = vi.fn()
    const setActiveSubTab = vi.fn()

    render(
      <ActorBankView
        activeProjectId="proj_actor_bank"
        onWorkflowCharacterSelect={onWorkflowCharacterSelect}
        setActiveStep={setActiveStep}
        setActiveSubTab={setActiveSubTab}
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

    expect(onWorkflowCharacterSelect).toHaveBeenCalledTimes(1)
    expect(onWorkflowCharacterSelect).toHaveBeenCalledWith({
      charId: CHAR_ID,
      bankSlug: CHAR_SLUG,
      source: 'actor-bank',
    })
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('projectId=proj_actor_bank'))
    expect(setActiveStep).toHaveBeenCalledTimes(1)
    expect(setActiveStep).toHaveBeenCalledWith(1)
    expect(setActiveSubTab).toHaveBeenCalledTimes(1)
    expect(setActiveSubTab).toHaveBeenCalledWith('casting-pipeline')
  })
})
