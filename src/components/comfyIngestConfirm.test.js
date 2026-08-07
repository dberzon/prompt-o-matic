import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { confirmedIngestPromptIds } from './comfyIngestConfirm.js'

describe('confirmedIngestPromptIds', () => {
  const jobs = [
    { promptId: 'p1', promptPackId: 'pack1' },
    { promptId: 'p2', promptPackId: 'pack2' },
  ]

  it('only returns promptIds whose ingest item has ok:true', () => {
    expect(
      confirmedIngestPromptIds(jobs, {
        ok: true,
        items: [
          { promptId: 'p1', ok: true, created: 1 },
          { promptId: 'p2', ok: false, error: 'Prompt pack not found' },
        ],
      }),
    ).toEqual(['p1'])
  })

  it('returns empty when items array is missing so callers retry', () => {
    expect(confirmedIngestPromptIds(jobs, { ok: true })).toEqual([])
    expect(confirmedIngestPromptIds(jobs, null)).toEqual([])
    expect(confirmedIngestPromptIds(jobs, undefined)).toEqual([])
  })

  it('returns empty when every item failed', () => {
    expect(
      confirmedIngestPromptIds(jobs, {
        ok: true,
        items: [
          { promptId: 'p1', ok: false },
          { promptId: 'p2', ok: false },
        ],
      }),
    ).toEqual([])
  })

  it('ignores ok items that were not in the requested batch', () => {
    expect(
      confirmedIngestPromptIds([{ promptId: 'p1' }], {
        items: [
          { promptId: 'p1', ok: true },
          { promptId: 'other', ok: true },
        ],
      }),
    ).toEqual(['p1'])
  })

  it('CastingPipelinePanel audit ingest only locks confirmed promptIds', () => {
    const source = fs.readFileSync(new URL('./CastingPipelinePanel.jsx', import.meta.url), 'utf8')
    const start = source.indexOf('// Auto-ingest newly succeeded jobs')
    const end = source.indexOf('// Clean up temp characters for failed preview renders')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const block = source.slice(start, end)
    expect(block).toContain('confirmedIngestPromptIds')
    expect(block).toContain('for (const id of confirmedIds) ingestedRef.current.add(id)')
    expect(block).not.toMatch(/for \(const j of toIngest\) ingestedRef\.current\.add/)
    expect(block).toContain('confirmedJobs.filter((j) => j.type === \'batchPreview\')')
  })
})
