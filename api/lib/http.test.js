import { describe, expect, it } from 'vitest'
import { getRequestQueryParam } from './http.js'

describe('getRequestQueryParam', () => {
  it('reads query params from Connect-style req.url when req.query is absent', () => {
    expect(getRequestQueryParam({ url: '/api/comfy-jobs?jobType=audition' }, 'jobType')).toBe('audition')
  })

  it('prefers framework-populated req.query values when present', () => {
    expect(getRequestQueryParam({
      url: '/api/comfy-jobs?jobType=portfolio',
      query: { jobType: 'audition' },
    }, 'jobType')).toBe('audition')
  })
})
