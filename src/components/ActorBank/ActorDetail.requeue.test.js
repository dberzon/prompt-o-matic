import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('ActorDetail portfolio requeue', () => {
  it('sends default views and persists Comfy jobs for Casting Room restore', () => {
    const source = fs.readFileSync(new URL('./ActorDetail.jsx', import.meta.url), 'utf8')
    const start = source.indexOf('const handleRequeue = async () => {')
    const end = source.indexOf('return (', start)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const handler = source.slice(start, end)
    expect(handler).toContain('views: DEFAULT_PORTFOLIO_VIEWS')
    expect(handler).toContain('saveComfyJobs(jobs)')
    expect(handler).toContain("patchCharacterLifecycle(id, 'portfolio_pending')")
    expect(handler).not.toMatch(/queueCharacterPortfolio\(\{\s*characterId:\s*id\s*\}\)/)
  })
})
