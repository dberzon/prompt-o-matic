/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ExtrapolationStepContainer from './ExtrapolationStepContainer.jsx'

vi.mock('./EntityExtrapolationPanel.jsx', () => ({
  default: () => <h3>Run extrapolation</h3>,
}))

vi.mock('./AttributeReviewPanel.jsx', () => ({
  default: () => <h3>Attribute review</h3>,
}))

vi.mock('./EntityConflictPanel.jsx', () => ({
  default: () => <h3>Stage 6 conflicts</h3>,
}))

vi.mock('./EntityContinuityQaPanel.jsx', () => ({
  default: () => <h3>MVP Done gate</h3>,
}))

vi.mock('../hooks/useExtrapolationStream.js', () => ({
  useExtrapolationStream: () => ({
    events: [],
    status: 'idle',
    error: '',
    warning: '',
    result: null,
    close: vi.fn(),
    liveStage: 0,
  }),
}))

afterEach(() => {
  cleanup()
})

const baseProps = {
  activeEntityId: null,
  setActiveStep: vi.fn(),
  onNext: vi.fn(),
  onPrev: vi.fn(),
}

describe('ExtrapolationStepContainer', () => {
  it('shows empty state when activeEntityId is null', () => {
    render(<ExtrapolationStepContainer {...baseProps} />)
    expect(screen.getByText(/lift a character to bible context in step 2 first/i)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /run extrapolation/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /go to bible/i }))
    expect(baseProps.setActiveStep).toHaveBeenCalledWith(2)
  })

  it('renders all four panels by display label when activeEntityId is set', () => {
    render(<ExtrapolationStepContainer {...baseProps} activeEntityId="ent_1" />)
    expect(screen.getByRole('heading', { name: /run extrapolation/i })).toBeTruthy()
    expect(screen.getByRole('region', { name: /extrapolation stream log/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /attribute review/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /stage 6 conflicts/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /mvp done gate/i })).toBeTruthy()
  })
})
