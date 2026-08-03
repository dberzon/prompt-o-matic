import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { toPersistedPortfolioJobs } from './castingPortfolioPersist.js'

describe('toPersistedPortfolioJobs', () => {
  it('tags batch portfolio jobs with jobType portfolio for comfy_jobs persistence', () => {
    const jobs = [
      {
        promptId: 'p1',
        promptPackId: 'pack1',
        view: 'front_portrait',
        characterId: 'char_a',
        workflowVersion: 'wf1',
        viewType: 'front_portrait',
      },
      {
        promptId: 'p2',
        promptPackId: 'pack2',
        view: 'profile_portrait',
        characterId: 'char_b',
        workflowVersion: 'wf1',
        viewType: 'profile_portrait',
      },
    ]

    expect(toPersistedPortfolioJobs(jobs)).toEqual([
      { ...jobs[0], jobType: 'portfolio' },
      { ...jobs[1], jobType: 'portfolio' },
    ])
  })

  it('returns empty for missing or empty job lists (no-op persist)', () => {
    expect(toPersistedPortfolioJobs([])).toEqual([])
    expect(toPersistedPortfolioJobs(null)).toEqual([])
    expect(toPersistedPortfolioJobs(undefined)).toEqual([])
  })

  it('CastingPipelinePanel batch portfolio queue persists jobs like single-character queue', () => {
    const source = fs.readFileSync(new URL('./CastingPipelinePanel.jsx', import.meta.url), 'utf8')
    const start = source.indexOf('async function handleQueueBatchPortfolios')
    const end = source.indexOf('async function handleGeneratedImageReview')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const batchHandler = source.slice(start, end)
    expect(batchHandler).toContain('saveComfyJobs(toPersistedPortfolioJobs(allJobs))')
    expect(batchHandler).toContain('startPortfolioPoll()')
  })
})
