/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import {
  WORKFLOW_PERSIST_DEBOUNCE_MS,
  WORKFLOW_PERSIST_KEY,
  WorkspaceProvider,
  useWorkspace,
} from './WorkspaceContext.jsx'

vi.mock('../api/promptStorage.js', () => ({
  fetchWorkspaceProfiles: vi.fn().mockResolvedValue([]),
  upsertWorkspaceProfileRemote: vi.fn().mockResolvedValue(null),
  deleteWorkspaceProfileRemote: vi.fn().mockResolvedValue(null),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  vi.useRealTimers()
})

function SceneProbe({ nextScene, onReady }) {
  const ws = useWorkspace()
  useEffect(() => {
    if (nextScene != null) ws.setScene(nextScene)
    onReady?.(ws)
  }, [nextScene, onReady, ws])
  return <div data-testid="scene">{ws.scene}</div>
}

function renderWorkspace(ui) {
  return render(<WorkspaceProvider>{ui}</WorkspaceProvider>)
}

describe('WorkspaceContext workflow persist', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('debounces qpb.workflow.v1 write within 1s after scene change', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    renderWorkspace(<SceneProbe nextScene="persisted scene" />)

    act(() => {
      vi.advanceTimersByTime(WORKFLOW_PERSIST_DEBOUNCE_MS)
    })

    const workflowWrites = setItem.mock.calls.filter(([key]) => key === WORKFLOW_PERSIST_KEY)
    expect(workflowWrites.length).toBeGreaterThan(0)
    const lastWrite = workflowWrites[workflowWrites.length - 1]
    expect(lastWrite[0]).toBe(WORKFLOW_PERSIST_KEY)
    const payload = JSON.parse(lastWrite[1])
    expect(payload.scene).toBe('persisted scene')
    expect(WORKFLOW_PERSIST_DEBOUNCE_MS).toBeLessThan(1000)
  })

  it('restores workspace fields from localStorage on a second mount', () => {
    localStorage.setItem(
      WORKFLOW_PERSIST_KEY,
      JSON.stringify({
        scene: 'restored on reload',
        dirKey: null,
        charCount: 2,
        chars: [
          { g: 'man', a: '40s' },
          { g: 'woman', a: '30s' },
        ],
        scenario: null,
        chips: { mood: ['rain'] },
        blend: { enabled: true, dirKey: null, weight: 72 },
        narrativeBeat: 'beat-restore',
        activeProjectId: 'proj_restore',
        activeCharId: 'char_restore',
      }),
    )

    const first = renderWorkspace(<SceneProbe />)
    expect(screen.getByTestId('scene').textContent).toBe('restored on reload')
    first.unmount()
    cleanup()

    renderWorkspace(<SceneProbe />)
    expect(screen.getByTestId('scene').textContent).toBe('restored on reload')
  })

  it('ignores malformed JSON in localStorage on mount without throwing', () => {
    localStorage.setItem(WORKFLOW_PERSIST_KEY, '{not valid json')
    expect(() => renderWorkspace(<SceneProbe />)).not.toThrow()
    expect(screen.getByTestId('scene').textContent).toBe('')
  })

  it('includes activeCharId in persist payload when registerWorkflowPersistSource is used', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    function RegisterAndSetScene() {
      const ws = useWorkspace()
      useEffect(() => {
        const unregister = ws.registerWorkflowPersistSource(() => ({
          activeProjectId: 'proj_live',
          activeCharId: 'char_live',
        }))
        ws.setScene('with workflow ids')
        return unregister
      }, [ws])
      return null
    }

    renderWorkspace(<RegisterAndSetScene />)
    act(() => {
      vi.advanceTimersByTime(WORKFLOW_PERSIST_DEBOUNCE_MS)
    })

    const workflowWrites = setItem.mock.calls.filter(([key]) => key === WORKFLOW_PERSIST_KEY)
    const payload = JSON.parse(workflowWrites[workflowWrites.length - 1][1])
    expect(payload.activeProjectId).toBe('proj_live')
    expect(payload.activeCharId).toBe('char_live')
    expect(payload.scene).toBe('with workflow ids')
  })
})
