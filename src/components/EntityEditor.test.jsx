/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import EntityEditor from './EntityEditor.jsx'
import { getEntity } from '../lib/api/entities.js'

vi.mock('../lib/api/entities.js', () => ({
  getEntity: vi.fn(),
}))

vi.mock('../features/bible/BibleEditor.jsx', () => ({
  default: ({ entityId }) => <div data-testid="T_ENTITY_EDITOR_BIBLE">Bible editor for {entityId}</div>,
}))

vi.mock('./CanonAttributesPanel.jsx', () => ({
  default: ({ sectionPrefix }) => <div data-testid="T_CANON_PANEL">Canon {sectionPrefix}</div>,
}))

vi.mock('./EntityExtrapolationPanel.jsx', () => ({
  default: () => <div data-testid="T_EXTRAPOLATION_PANEL">Extrapolation</div>,
}))

vi.mock('./VisualAnchorPicker.jsx', () => ({
  default: () => <div data-testid="T_VISUAL_ANCHOR_PICKER">Visual anchor</div>,
}))

vi.mock('./AttributeReviewPanel.jsx', () => ({
  default: () => <div data-testid="T_ATTRIBUTE_REVIEW_PANEL">Attribute review</div>,
}))

vi.mock('./EntityConflictPanel.jsx', () => ({
  default: () => <div data-testid="T_ENTITY_CONFLICT_PANEL">Conflicts</div>,
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('EntityEditor', () => {
  it('exposes the Bible editor from the entity section navigation', async () => {
    vi.mocked(getEntity).mockResolvedValue({
      item: { id: 'ent_bible', type: 'character', name: 'Bible Character' },
    })

    render(<EntityEditor entityId="ent_bible" />)

    await waitFor(() => expect(screen.getByText('Bible Character')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Bible' }))

    expect(screen.getByTestId('T_ENTITY_EDITOR_BIBLE').textContent).toContain('ent_bible')
    expect(screen.queryByTestId('T_EXTRAPOLATION_PANEL')).toBeNull()
    expect(screen.queryByTestId('T_ATTRIBUTE_REVIEW_PANEL')).toBeNull()
    expect(screen.queryByTestId('T_ENTITY_CONFLICT_PANEL')).toBeNull()
  })
})
