/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import NavigationStepper from './NavigationStepper.jsx'

afterEach(() => {
  cleanup()
})

const STEP_LABELS = [
  'Casting',
  'Bible',
  'Extrapolation',
  'Prompt Studio',
  'Render',
  'Portfolio',
]

describe('NavigationStepper', () => {
  it('clicking each step label calls setActiveStep with index 1–6', () => {
    const setActiveStep = vi.fn()
    render(<NavigationStepper activeStep={1} setActiveStep={setActiveStep} />)

    STEP_LABELS.forEach((label, i) => {
      setActiveStep.mockClear()
      fireEvent.click(screen.getByRole('button', { name: new RegExp(label, 'i') }))
      expect(setActiveStep).toHaveBeenCalledTimes(1)
      expect(setActiveStep).toHaveBeenCalledWith(i + 1)
    })
  })
})
