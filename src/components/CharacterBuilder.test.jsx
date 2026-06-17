/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CharacterBuilder from './CharacterBuilder.jsx'
import { listBankEntries, createBankEntry, updateBankEntry, deleteBankEntry } from '../lib/api/characterBank.js'
import { liftEntityFromBankEntry } from '../lib/api/entities.js'

vi.mock('../hooks/useCharacterOptimize.js', () => ({
  useCharacterOptimize: () => ({
    state: 'idle',
    optimized: '',
    provider: null,
    fallback: null,
    error: null,
    optimize: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('../lib/api/characterBank.js', () => ({
  listBankEntries: vi.fn(),
  createBankEntry: vi.fn(),
  updateBankEntry: vi.fn(),
  deleteBankEntry: vi.fn(),
}))

vi.mock('../lib/api/entities.js', () => ({
  liftEntityFromBankEntry: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('CharacterBuilder', () => {
  it('notifies workflow selection when opening a saved character as an entity', async () => {
    listBankEntries.mockResolvedValue({ items: [] })
    createBankEntry.mockResolvedValue({ item: null })
    updateBankEntry.mockResolvedValue({ item: null })
    deleteBankEntry.mockResolvedValue({ ok: true })
    liftEntityFromBankEntry.mockResolvedValue({ ok: true, entity: { id: 'entity_ivan' } })
    const onWorkflowCharacterSelect = vi.fn()
    const onOpenEntityEditor = vi.fn()

    render(
      <CharacterBuilder
        characters={{
          ivan: {
            slug: 'ivan',
            name: 'Ivan',
            rawDescription: 'A grounded actor',
            optimizedDescription: '',
            createdAt: 1,
          },
        }}
        setCharacters={vi.fn()}
        aiEngine="auto"
        localOnly={false}
        embeddedStatus={null}
        onOpenEntityEditor={onOpenEntityEditor}
        onWorkflowCharacterSelect={onWorkflowCharacterSelect}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /open as entity/i }))

    await waitFor(() => {
      expect(onWorkflowCharacterSelect).toHaveBeenCalledWith({
        charId: 'ivan',
        entityId: 'entity_ivan',
        bankSlug: 'ivan',
        source: 'character-builder',
      })
    })
    expect(onOpenEntityEditor).toHaveBeenCalledWith('entity_ivan')
  })
})
