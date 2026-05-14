/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import CompletenessRing from './CompletenessRing.jsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** @returns {import('../../lib/api/bibles.js').CompletenessReport} */
function baseReport(overrides = {}) {
  return {
    ratio: 0,
    requiredCount: 4,
    recommendedCount: 2,
    presentRequired: 0,
    presentRecommended: 0,
    missingRequired: [],
    missingRecommended: [],
    ...overrides,
  }
}

function expectRatioArcMatches(size, ratio) {
  const half = size / 2
  const stroke = Math.max(3, size * 0.075)
  const radius = Math.max(4, half - stroke * 1.25)
  const circ = 2 * Math.PI * radius
  const arc = screen.getByTestId('completeness-ratio-arc')
  expect(parseFloat(arc.getAttribute('r') || '0')).toBeCloseTo(radius, 5)
  expect(parseFloat(arc.getAttribute('stroke-dashoffset') || 'NaN')).toBeCloseTo(circ * (1 - ratio), 5)
  const [a, b] = (arc.getAttribute('stroke-dasharray') || '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  expect(a).toBeCloseTo(circ, 5)
  expect(b).toBeCloseTo(circ, 5)
}

describe('CompletenessRing', () => {
  it('maps ratio 0, 0.5, and 1.0 to stroke-dashoffset on the ratio arc', () => {
    const { rerender } = render(<CompletenessRing report={baseReport({ ratio: 0 })} size={120} />)
    expectRatioArcMatches(120, 0)

    rerender(<CompletenessRing report={baseReport({ ratio: 0.5 })} size={120} />)
    expectRatioArcMatches(120, 0.5)

    rerender(<CompletenessRing report={baseReport({ ratio: 1 })} size={120} />)
    expectRatioArcMatches(120, 1)
  })

  it('shows rounded percentage in the center', () => {
    render(<CompletenessRing report={baseReport({ ratio: 0.334 })} size={100} />)
    expect(screen.getByText('33%')).toBeTruthy()
  })

  it('exposes an aria-label summarizing ratio and required/recommended fill state', () => {
    render(
      <CompletenessRing
        report={baseReport({
          ratio: 0.75,
          requiredCount: 4,
          recommendedCount: 2,
          presentRequired: 3,
          presentRecommended: 1,
        })}
        size={80}
      />,
    )
    const img = screen.getByRole('img', {
      name: /Completeness 75 percent.*3 of 4 required fields filled.*1 of 2 recommended fields filled/i,
    })
    expect(img).toBeTruthy()
  })

  it('describes empty required or recommended tiers in the aria-label', () => {
    render(<CompletenessRing report={baseReport({ ratio: 1, requiredCount: 0, recommendedCount: 0 })} size={80} />)
    expect(
      screen.getByRole('img', {
        name: /Completeness 100 percent.*no required fields in schema.*no recommended fields in schema/i,
      }),
    ).toBeTruthy()
  })
})
