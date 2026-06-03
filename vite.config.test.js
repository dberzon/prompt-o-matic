import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import {
  chromaProbeBaseUrls,
  isChromaRunning,
  startChromaServer,
} from './vite.config.js'

describe('Chroma dev-server helpers', () => {
  it('probes only the configured custom Chroma port and its loopback alias', async () => {
    const urls = chromaProbeBaseUrls('http://localhost:8001')
    expect(urls).toEqual(['http://localhost:8001', 'http://127.0.0.1:8001'])
    expect(urls.some((url) => url.includes(':8000'))).toBe(false)

    const fetchImpl = vi.fn(async () => ({ ok: false }))
    const available = await isChromaRunning('http://localhost:8001', fetchImpl)
    expect(available).toBe(false)
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:8001/api/v2/heartbeat',
      'http://localhost:8001/api/v1/heartbeat',
      'http://127.0.0.1:8001/api/v2/heartbeat',
      'http://127.0.0.1:8001/api/v1/heartbeat',
    ])
  })

  it('does not auto-start a default Chroma process for a custom CHROMA_URL', async () => {
    const spawnImpl = vi.fn()
    const consoleImpl = { log: vi.fn(), warn: vi.fn() }

    await startChromaServer('./chroma_data', 'http://localhost:8001', {
      consoleImpl,
      isRunning: vi.fn(async () => false),
      processImpl: { once: vi.fn() },
      spawnImpl,
    })

    expect(spawnImpl).not.toHaveBeenCalled()
    expect(consoleImpl.log).toHaveBeenCalledWith(expect.stringContaining('CHROMA_URL is http://localhost:8001'))
  })

  it('handles a missing Chroma binary without throwing', async () => {
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.kill = vi.fn()
    const spawnImpl = vi.fn(() => child)
    const consoleImpl = { log: vi.fn(), warn: vi.fn() }

    await startChromaServer('./chroma_data', 'http://localhost:8000', {
      consoleImpl,
      env: { PATH: '/usr/bin' },
      isRunning: vi.fn(async () => false),
      processImpl: { once: vi.fn() },
      spawnImpl,
    })
    child.emit('error', Object.assign(new Error('missing'), { code: 'ENOENT' }))

    expect(spawnImpl).toHaveBeenCalledWith(
      'chroma',
      ['run', '--path', './chroma_data'],
      expect.objectContaining({ windowsHide: true }),
    )
    expect(consoleImpl.warn).toHaveBeenCalledWith(expect.stringContaining('ENOENT'))
  })
})
