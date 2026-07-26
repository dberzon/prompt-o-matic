/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import PromptOutput from './PromptOutput.jsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('PromptOutput Comfy poll resilience', () => {
  it('keeps polling after a transient status-check failure and still ingests success', async () => {
    let statusCalls = 0
    let ingestCalls = 0
    /** @type {((value: unknown) => void) | null} */
    let releaseSecondStatus = null
    const secondStatusGate = new Promise((resolve) => {
      releaseSecondStatus = resolve
    })

    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = String(input)
      if (url === '/api/saved-prompts') return jsonResponse({ items: [] })
      if (url === '/api/comfy-queue-builder-prompt') {
        return jsonResponse({
          promptId: 'prompt-1',
          promptPackId: 'pack-1',
          characterId: 'char-1',
          workflowId: 'wf-1',
        })
      }
      if (url === '/api/comfy-jobs-status') {
        statusCalls += 1
        if (statusCalls === 1) {
          // Transient probe failure: ok:false and no terminal status (matches api/comfy-jobs-status.js catch path).
          return jsonResponse({
            ok: true,
            items: [{
              promptId: 'prompt-1',
              promptPackId: 'pack-1',
              view: 'cinematic_scene',
              ok: false,
              error: 'ComfyUI timeout',
            }],
          })
        }
        await secondStatusGate
        return jsonResponse({
          ok: true,
          items: [{
            promptId: 'prompt-1',
            promptPackId: 'pack-1',
            view: 'cinematic_scene',
            ok: true,
            status: 'success',
          }],
        })
      }
      if (url === '/api/comfy-ingest-outputs') {
        ingestCalls += 1
        return jsonResponse({ items: [{ id: 'img-1' }] })
      }
      if (url.startsWith('/api/generated-images')) return jsonResponse({ items: [] })
      return jsonResponse({ ok: true })
    }))

    render(
      <PromptOutput
        prompt={['a cinematic portrait']}
        scene="base scene"
        scenario={null}
        comfyStatus={{ available: true }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /render in comfyui/i }))

    await waitFor(() => {
      expect(screen.getByText(/Rendering/i)).toBeTruthy()
      expect(statusCalls).toBeGreaterThanOrEqual(1)
    })

    // First poll already ran with ok:false — must NOT flip to failed.
    expect(screen.queryByText(/ComfyUI timeout/i)).toBeNull()
    expect(screen.queryByText(/ComfyUI render failed/i)).toBeNull()
    expect(ingestCalls).toBe(0)

    // Wait for the interval poll (2s) to start the second status request, then release success.
    await waitFor(() => {
      expect(statusCalls).toBeGreaterThanOrEqual(2)
    }, { timeout: 4000 })
    releaseSecondStatus?.()

    await waitFor(() => {
      expect(ingestCalls).toBe(1)
    })
  })
})
