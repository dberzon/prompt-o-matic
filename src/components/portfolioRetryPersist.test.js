import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildPortfolioRetryPersist } from './portfolioRetryPersist.js'

describe('buildPortfolioRetryPersist', () => {
  it('tags replacement jobs for portfolio persistence and lists old ids', () => {
    const replacements = new Map([
      [
        'old_a',
        {
          promptId: 'new_a',
          promptPackId: 'pack_a',
          characterId: 'char_1',
          view: 'front_portrait',
          viewType: 'front_portrait',
          retryCount: 1,
        },
      ],
      [
        'old_b',
        {
          promptId: 'new_b',
          promptPackId: 'pack_b',
          characterId: 'char_1',
          view: 'profile_portrait',
          viewType: 'profile_portrait',
          retryCount: 1,
        },
      ],
    ])

    expect(buildPortfolioRetryPersist(replacements)).toEqual({
      oldPromptIds: ['old_a', 'old_b'],
      newJobs: [
        { ...replacements.get('old_a'), jobType: 'portfolio' },
        { ...replacements.get('old_b'), jobType: 'portfolio' },
      ],
    })
  })

  it('returns empty lists for missing or empty replacements', () => {
    expect(buildPortfolioRetryPersist(new Map())).toEqual({ oldPromptIds: [], newJobs: [] })
    expect(buildPortfolioRetryPersist(null)).toEqual({ oldPromptIds: [], newJobs: [] })
    expect(buildPortfolioRetryPersist(undefined)).toEqual({ oldPromptIds: [], newJobs: [] })
  })

  it('CastingPipelinePanel portfolio retry persists replacements and terminalizes old ids', () => {
    const source = fs.readFileSync(new URL('./CastingPipelinePanel.jsx', import.meta.url), 'utf8')
    const start = source.indexOf('portfolioTickRef.current = async () => {')
    const end = source.indexOf('function startPortfolioPoll()')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const tick = source.slice(start, end)
    expect(tick).toContain('buildPortfolioRetryPersist(replacements)')
    expect(tick).toContain('markComfyJobsDone(oldPromptIds')
    expect(tick).toContain('saveComfyJobs(newJobs)')
    expect(tick).toContain('confirmedIngestPromptIds')
  })
})
