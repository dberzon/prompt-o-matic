/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CastingPipelinePanel from './CastingPipelinePanel.jsx'
import * as characterBatches from '../lib/api/characterBatches.js'
import * as comfyApi from '../lib/api/comfy.js'
import * as generatedImages from '../lib/api/generatedImages.js'
import * as portfolioApi from '../lib/api/portfolio.js'
import * as promptPacks from '../lib/api/promptPacks.js'
import * as auditionApi from '../lib/api/audition.js'
import * as actorAuditions from '../lib/api/actorAuditions.js'
import * as characterBank from '../lib/api/characterBank.js'

const BANK_ID = 'bank_ivan'
const CHAR_ID = 'char_audition_1'
const AUDITION_ID = 'aud_look_1'

beforeEach(() => {
  vi.spyOn(characterBatches, 'listCharacterBatches').mockResolvedValue({ items: [] })
  vi.spyOn(characterBatches, 'listCharacters').mockResolvedValue({
    items: [{ id: CHAR_ID, name: 'Ivan', age: 34, lifecycleStatus: 'auditioned' }],
  })
  vi.spyOn(characterBatches, 'getCharacterBatch').mockResolvedValue({ item: null })
  vi.spyOn(characterBatches, 'listBatchCandidates').mockResolvedValue({ items: [] })
  vi.spyOn(comfyApi, 'listComfyWorkflows').mockResolvedValue({ workflows: [] })
  vi.spyOn(comfyApi, 'listActiveComfyJobs').mockResolvedValue({ jobs: [] })
  vi.spyOn(comfyApi, 'getChromaHealth').mockResolvedValue({ available: true })
  vi.spyOn(comfyApi, 'saveComfyJobs').mockResolvedValue({ ok: true })
  vi.spyOn(generatedImages, 'listGeneratedImages').mockResolvedValue({ items: [] })
  vi.spyOn(promptPacks, 'listPromptPacksForCharacter').mockResolvedValue({ items: [] })
  vi.spyOn(promptPacks, 'compilePromptPacksForCharacter').mockResolvedValue({ ok: true })
  vi.spyOn(characterBank, 'listBankEntries').mockResolvedValue({
    items: [{ id: BANK_ID, slug: 'ivan', name: 'Ivan', description: 'weathered fixer' }],
  })
  vi.spyOn(auditionApi, 'generateAudition').mockResolvedValue({
    requested: 1,
    successful: 1,
    failed: 0,
    results: [{
      ok: true,
      pairId: 'pair_1',
      characterId: CHAR_ID,
      character: { name: 'Ivan', age: 34 },
      views: [{
        ok: true,
        view: 'front_portrait',
        auditionId: AUDITION_ID,
        actorCandidateId: 'cand_1',
        promptPackId: 'pack_1',
      }],
    }],
  })
  vi.spyOn(actorAuditions, 'approveActorAudition').mockResolvedValue({
    ok: true,
    item: { id: AUDITION_ID, status: 'approved' },
  })
  vi.spyOn(portfolioApi, 'queueCharacterPortfolio').mockResolvedValue({ queued: [], summary: { success: 0 } })
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('CastingPipelinePanel Select this look', () => {
  it('approves the audition and selects the character without crashing', async () => {
    render(<CastingPipelinePanel comfyStatus={{ available: false }} />)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /@ivan — Ivan/i })).toBeTruthy()
    })

    fireEvent.change(screen.getByDisplayValue('Select a character…'), { target: { value: BANK_ID } })
    fireEvent.click(screen.getByRole('button', { name: /generate auditions/i }))

    const selectLook = await screen.findByRole('button', { name: /select this look/i })
    fireEvent.click(selectLook)

    await waitFor(() => {
      expect(actorAuditions.approveActorAudition).toHaveBeenCalledWith(AUDITION_ID)
    })
    expect(portfolioApi.queueCharacterPortfolio).not.toHaveBeenCalled()
    expect(await screen.findByText(/character ready — select them in active character/i)).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /✓ selected/i })).toBeTruthy()
    })
    const activeSelect = screen.getByDisplayValue(/Ivan, 34/)
    expect(activeSelect.value).toBe(CHAR_ID)
  })

  it('surfaces an approve failure instead of leaving the look unselectable', async () => {
    actorAuditions.approveActorAudition.mockRejectedValueOnce(new Error('Audition not found'))
    render(<CastingPipelinePanel comfyStatus={{ available: false }} />)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /@ivan — Ivan/i })).toBeTruthy()
    })
    fireEvent.change(screen.getByDisplayValue('Select a character…'), { target: { value: BANK_ID } })
    fireEvent.click(screen.getByRole('button', { name: /generate auditions/i }))

    fireEvent.click(await screen.findByRole('button', { name: /select this look/i }))

    expect(await screen.findByText(/audition not found/i)).toBeTruthy()
    expect(screen.queryByText(/character ready/i)).toBeNull()
  })
})
