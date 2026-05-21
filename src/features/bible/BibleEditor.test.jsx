/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import BibleEditor from './BibleEditor.jsx'

vi.mock('../../lib/api/bibles.js', () => ({
  fetchBible: vi.fn(),
  fetchBibleCompleteness: vi.fn(),
  approveBibleSection: vi.fn(),
}))

vi.mock('../../lib/api/entityAttributes.js', () => ({
  listEntityAttributes: vi.fn(),
}))

import { approveBibleSection, fetchBible, fetchBibleCompleteness } from '../../lib/api/bibles.js'
import { listEntityAttributes } from '../../lib/api/entityAttributes.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** @returns {import('../../lib/api/bibles.js').CompletenessReport} */
function completenessReport() {
  return {
    ratio: 0.5,
    requiredCount: 4,
    recommendedCount: 4,
    presentRequired: 2,
    presentRecommended: 2,
    missingRequired: [],
    missingRecommended: [],
  }
}

const characterBible = {
  demographics: { gender: 'm', ageRange: '30s', eraLabel: '1990s' },
  physical: {
    height: 'tall',
    build: 'lean',
    face: 'angular',
    eyes: 'brown',
    nose: 'straight',
    lips: 'thin',
    skin: 'fair',
  },
  relationships: [],
  visuals: { portraitBrief: 'Test', continuityKeywords: [] },
}

const locationBible = {
  identity: { name: 'Warehouse', summary: 'Industrial interior' },
  geography: { placement: 'docks' },
  function: { purposeInStory: 'chase' },
  visuals: { shotPriority: 'wide', moodKeywords: [] },
  inhabitants: [],
}

describe('BibleEditor', () => {
  it('shows loading until fetchBible resolves', async () => {
    vi.mocked(fetchBible).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ bible: characterBible, provenance: {} }), 50)),
    )
    vi.mocked(fetchBibleCompleteness).mockResolvedValue(completenessReport())
    vi.mocked(listEntityAttributes).mockResolvedValue({ items: [] })

    render(<BibleEditor entityId="ent_c" />)
    expect(screen.getByTestId('T_BIBLE_EDITOR_LOADING')).toBeTruthy()

    await waitFor(() => {
      expect(screen.queryByTestId('T_BIBLE_EDITOR_LOADING')).toBeNull()
    })
    expect(screen.getByTestId('T_BIBLE_EDITOR')).toBeTruthy()
  })

  it('shows error when fetchBible rejects', async () => {
    vi.mocked(fetchBible).mockRejectedValue(new Error('boom'))
    vi.mocked(fetchBibleCompleteness).mockResolvedValue(completenessReport())
    vi.mocked(listEntityAttributes).mockResolvedValue({ items: [] })

    render(<BibleEditor entityId="ent_x" />)
    await waitFor(() => {
      expect(screen.getByTestId('T_BIBLE_EDITOR_ERROR').textContent).toContain('boom')
    })
  })

  it('renders character bible object sections and completeness ring', async () => {
    vi.mocked(fetchBible).mockResolvedValue({ bible: characterBible, provenance: { 'demographics.gender': 'canon' } })
    vi.mocked(fetchBibleCompleteness).mockResolvedValue(completenessReport())
    vi.mocked(listEntityAttributes).mockResolvedValue({ items: [] })

    render(<BibleEditor entityId="ent_ch" />)
    await waitFor(() => expect(screen.getByTestId('T_BIBLE_EDITOR')).toBeTruthy())

    const panels = screen.getAllByTestId('T_BIBLE_SECTION_PANEL')
    const names = panels.map((p) => p.getAttribute('data-section'))
    expect(names).toContain('demographics')
    expect(names).toContain('physical')
    expect(names).toContain('visuals')
    expect(names).not.toContain('relationships')

    expect(screen.getByTestId('completeness-ratio-arc')).toBeTruthy()
    expect(screen.getByText('Attribute review')).toBeTruthy()
    expect(screen.getByText('Stage 6 conflicts')).toBeTruthy()
  })

  it('renders location bible with different object sections than character', async () => {
    vi.mocked(fetchBible).mockResolvedValue({ bible: locationBible, provenance: {} })
    vi.mocked(fetchBibleCompleteness).mockResolvedValue(completenessReport())
    vi.mocked(listEntityAttributes).mockResolvedValue({ items: [] })

    render(<BibleEditor entityId="ent_loc" />)
    await waitFor(() => expect(screen.getByTestId('T_BIBLE_EDITOR')).toBeTruthy())

    const names = screen.getAllByTestId('T_BIBLE_SECTION_PANEL').map((p) => p.getAttribute('data-section'))
    expect(names).toEqual(expect.arrayContaining(['identity', 'geography', 'function', 'visuals']))
    expect(names).not.toContain('demographics')
  })

  it('uses entityType to render sections for an otherwise empty draft bible', async () => {
    vi.mocked(fetchBible).mockResolvedValue({ bible: {}, provenance: {}, entityType: 'character' })
    vi.mocked(fetchBibleCompleteness).mockResolvedValue(completenessReport())
    vi.mocked(listEntityAttributes).mockResolvedValue({ items: [] })

    render(<BibleEditor entityId="ent_empty" />)
    await waitFor(() => expect(screen.getByTestId('T_BIBLE_EDITOR')).toBeTruthy())

    const names = screen.getAllByTestId('T_BIBLE_SECTION_PANEL').map((p) => p.getAttribute('data-section'))
    expect(names).toEqual(expect.arrayContaining(['demographics', 'physical', 'visuals']))
  })

  it('refetches bible after section approve', async () => {
    vi.mocked(fetchBible).mockResolvedValue({ bible: characterBible, provenance: {} })
    vi.mocked(fetchBibleCompleteness).mockResolvedValue(completenessReport())
    vi.mocked(listEntityAttributes).mockResolvedValue({ items: [] })
    vi.mocked(approveBibleSection).mockResolvedValue({ ok: true })

    render(<BibleEditor entityId="ent_ap" />)
    await waitFor(() => expect(screen.getByTestId('T_BIBLE_EDITOR')).toBeTruthy())

    const fetchCountBefore = fetchBible.mock.calls.length
    fireEvent.click(screen.getAllByTestId('T_BIBLE_APPROVE')[0])

    await waitFor(() => {
      expect(approveBibleSection).toHaveBeenCalledWith('ent_ap', 'demographics')
    })
    await waitFor(() => {
      expect(fetchBible.mock.calls.length).toBeGreaterThan(fetchCountBefore)
    })
  })
})
