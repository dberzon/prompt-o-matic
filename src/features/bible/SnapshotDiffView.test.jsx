/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import SnapshotDiffView from './SnapshotDiffView.jsx'

vi.mock('../../lib/api/bibles.js', () => ({
  listSnapshots: vi.fn(),
  getSnapshot: vi.fn(),
}))

import { getSnapshot, listSnapshots } from '../../lib/api/bibles.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** @returns {import('../../lib/api/bibles.js').SnapshotRecord} */
function snapshot(id, label, bibleJson, createdAt = '2026-05-01T12:00:00.000Z') {
  return {
    id,
    entityId: 'ent_1',
    projectId: null,
    label,
    bibleJson,
    parentSnapshotId: null,
    createdAt,
  }
}

describe('SnapshotDiffView', () => {
  it('populates both dropdowns from listSnapshots', async () => {
    vi.mocked(listSnapshots).mockResolvedValue([
      snapshot('snap_a', 'Alpha', { demographics: { gender: 'm' } }),
      snapshot('snap_b', 'Beta', { demographics: { gender: 'f' } }, '2026-05-02T12:00:00.000Z'),
    ])

    render(<SnapshotDiffView entityId="ent_1" />)

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-diff-select-a')).toBeTruthy()
    })

    const selectA = screen.getByTestId('snapshot-diff-select-a')
    const selectB = screen.getByTestId('snapshot-diff-select-b')
    expect(selectA.querySelectorAll('option')).toHaveLength(3)
    expect(selectB.querySelectorAll('option')).toHaveLength(3)
    expect(selectA.textContent).toMatch(/Alpha/)
    expect(selectA.textContent).toMatch(/Beta/)
    expect(selectB.textContent).toMatch(/Alpha/)
    expect(selectB.textContent).toMatch(/Beta/)
  })

  it('shows no changes when identical snapshots are selected', async () => {
    const payload = { demographics: { gender: 'm', ageRange: '30s' } }
    vi.mocked(listSnapshots).mockResolvedValue([
      snapshot('snap_a', 'Alpha', payload),
      snapshot('snap_b', 'Beta', payload),
    ])
    vi.mocked(getSnapshot).mockImplementation(async (id) => {
      if (id === 'snap_a') return snapshot('snap_a', 'Alpha', payload)
      if (id === 'snap_b') return snapshot('snap_b', 'Beta', payload)
      throw new Error('missing')
    })

    render(<SnapshotDiffView entityId="ent_1" />)

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-diff-select-a')).toBeTruthy()
    })

    fireEvent.change(screen.getByTestId('snapshot-diff-select-a'), { target: { value: 'snap_a' } })
    fireEvent.change(screen.getByTestId('snapshot-diff-select-b'), { target: { value: 'snap_b' } })

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-diff-no-changes')).toBeTruthy()
    })
  })

  it('renders unified diff text when snapshots differ', async () => {
    vi.mocked(listSnapshots).mockResolvedValue([
      snapshot('snap_a', 'Alpha', { demographics: { gender: 'm' } }),
      snapshot('snap_b', 'Beta', { demographics: { gender: 'f' } }),
    ])
    vi.mocked(getSnapshot).mockImplementation(async (id) => {
      if (id === 'snap_a') return snapshot('snap_a', 'Alpha', { demographics: { gender: 'm' } })
      if (id === 'snap_b') return snapshot('snap_b', 'Beta', { demographics: { gender: 'f' } })
      throw new Error('missing')
    })

    render(<SnapshotDiffView entityId="ent_1" />)

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-diff-select-a')).toBeTruthy()
    })

    fireEvent.change(screen.getByTestId('snapshot-diff-select-a'), { target: { value: 'snap_a' } })
    fireEvent.change(screen.getByTestId('snapshot-diff-select-b'), { target: { value: 'snap_b' } })

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-diff-output')).toBeTruthy()
    })

    const text = screen.getByTestId('snapshot-diff-output').textContent || ''
    expect(text).toMatch(/-|\+/)
    expect(text).toMatch(/"m"/)
    expect(text).toMatch(/"f"/)
  })

  it('shows fetch error when getSnapshot returns 404', async () => {
    vi.mocked(listSnapshots).mockResolvedValue([
      snapshot('snap_a', 'Alpha', { demographics: { gender: 'm' } }),
      snapshot('snap_b', 'Beta', { demographics: { gender: 'f' } }),
    ])
    vi.mocked(getSnapshot).mockImplementation(async (id) => {
      if (id === 'snap_a') return snapshot('snap_a', 'Alpha', { demographics: { gender: 'm' } })
      const err = new Error('Snapshot not found')
      err.status = 404
      throw err
    })

    render(<SnapshotDiffView entityId="ent_1" />)

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-diff-select-a')).toBeTruthy()
    })

    fireEvent.change(screen.getByTestId('snapshot-diff-select-a'), { target: { value: 'snap_a' } })
    fireEvent.change(screen.getByTestId('snapshot-diff-select-b'), { target: { value: 'snap_b' } })

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-diff-fetch-error')).toBeTruthy()
    })
    expect(screen.queryByTestId('snapshot-diff-output')).toBeNull()
  })
})
