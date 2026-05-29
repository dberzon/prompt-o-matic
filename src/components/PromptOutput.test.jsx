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

function renderPromptOutput(props = {}) {
  return render(
    <PromptOutput
      prompt={['base prompt']}
      scene="base scene"
      scenario={null}
      {...props}
    />,
  )
}

describe('PromptOutput polish state', () => {
  it('clears stale polished text when the assembled prompt changes', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url) === '/api/saved-prompts') return jsonResponse({ items: [] })
      if (String(url) === '/api/polish') return jsonResponse({ polished: 'polished prompt', provider: 'mock' })
      return jsonResponse({})
    }))

    const { rerender } = renderPromptOutput()

    fireEvent.click(screen.getByRole('button', { name: /polish with ai/i }))

    await waitFor(() => {
      expect(screen.getByText('polished prompt')).toBeTruthy()
    })

    rerender(
      <PromptOutput
        prompt={['updated prompt']}
        scene="updated scene"
        scenario={null}
      />,
    )

    expect(screen.queryByText('polished prompt')).toBeNull()
    expect(screen.getByText('updated prompt')).toBeTruthy()
  })

  it('preserves manual text when polishing the current text fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url) === '/api/saved-prompts') return jsonResponse({ items: [] })
      if (String(url) === '/api/polish') return jsonResponse({ error: 'provider down' }, { status: 500 })
      return jsonResponse({})
    }))

    renderPromptOutput()

    fireEvent.click(screen.getByRole('button', { name: /edit prompt/i }))
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'manual prompt' },
    })
    fireEvent.click(screen.getByRole('button', { name: /polish current text/i }))

    await waitFor(() => {
      expect(screen.getByText(/provider down/i)).toBeTruthy()
    })
    expect(screen.getByText('manual prompt')).toBeTruthy()
  })
})
