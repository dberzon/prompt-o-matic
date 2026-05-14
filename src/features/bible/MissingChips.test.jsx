/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import MissingChips from './MissingChips.jsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** @returns {import('../../lib/api/bibles.js').CompletenessReport} */
function report(overrides = {}) {
  return {
    ratio: 0,
    requiredCount: 0,
    recommendedCount: 0,
    presentRequired: 0,
    presentRecommended: 0,
    missingRequired: [],
    missingRecommended: [],
    ...overrides,
  }
}

describe('MissingChips', () => {
  it('renders an empty row when there are no missing entries', () => {
    render(<MissingChips report={report()} />)
    expect(screen.getByTestId('missing-chips-empty')).toBeTruthy()
    expect(screen.queryByTestId('missing-chips')).toBeNull()
  })

  it('renders one chip per missing field when at or below the visible cap', () => {
    render(
      <MissingChips
        report={report({
          missingRequired: [
            { section: 'demographics', field: 'gender' },
            { section: 'demographics', field: 'ageRange' },
          ],
          missingRecommended: [{ section: 'demographics', field: 'notes' }],
        })}
      />,
    )
    expect(screen.getByText('demographics · gender')).toBeTruthy()
    expect(screen.getByText('demographics · ageRange')).toBeTruthy()
    expect(screen.getByText('demographics · notes')).toBeTruthy()
    expect(screen.queryByText(/\+\d+ more/)).toBeNull()
  })

  it('shows at most five chips plus an overflow summary', () => {
    const missingRequired = [
      { section: 'a', field: '1' },
      { section: 'a', field: '2' },
      { section: 'a', field: '3' },
    ]
    const missingRecommended = [
      { section: 'b', field: '1' },
      { section: 'b', field: '2' },
      { section: 'b', field: '3' },
      { section: 'b', field: '4' },
    ]
    render(<MissingChips report={report({ missingRequired, missingRecommended })} />)
    const row = screen.getByTestId('missing-chips')
    expect(row).toBeTruthy()
    expect(row.children.length).toBe(6)
    expect(screen.getByText('+2 more')).toBeTruthy()
  })

  it('invokes onChipClick with section and field for interactive chips', () => {
    const onChipClick = vi.fn()
    render(
      <MissingChips
        onChipClick={onChipClick}
        report={report({
          missingRequired: [{ section: 'demographics', field: 'gender' }],
        })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'demographics · gender' }))
    expect(onChipClick).toHaveBeenCalledWith('demographics', 'gender')
  })
})
