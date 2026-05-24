/**
 * @vitest-environment jsdom
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import CastingStepContainer from './CastingStepContainer.jsx'

function CastingStepHarness(props) {
  const [activeSubTab, setActiveSubTab] = useState('casting-pipeline')
  return (
    <CastingStepContainer
      {...props}
      activeSubTab={activeSubTab}
      setActiveSubTab={setActiveSubTab}
    />
  )
}

vi.mock('./CastingPipelinePanel.jsx', () => ({
  default: ({ onWorkflowCharacterSelect }) => {
    const handleBankSelect = (event) => {
      const option = event.target.selectedOptions[0]
      onWorkflowCharacterSelect?.({
        charId: event.target.value,
        bankSlug: option?.dataset.bankSlug || null,
        source: 'casting-pipeline',
      })
    }
    return (
      <>
        <select data-testid="mock-pipeline-select" defaultValue="" onChange={handleBankSelect}>
          <option value="">Select character…</option>
          <option value="char_pipeline" data-bank-slug="rita">Pipeline character</option>
        </select>
        <select data-testid="mock-workflow-select" defaultValue="">
          <option value="">Default workflow</option>
          <option value="workflow-not-character">Workflow preset</option>
        </select>
      </>
    )
  },
}))

vi.mock('./CharacterBuilder.jsx', () => ({
  default: ({ onWorkflowCharacterSelect }) => (
    <button
      type="button"
      data-testid="mock-builder-char"
      onClick={() => onWorkflowCharacterSelect?.({
        charId: 'char_builder',
        bankSlug: 'ivan',
        entityId: 'ent_builder',
        source: 'character-builder',
      })}
    >
      Pick builder character
    </button>
  ),
}))

vi.mock('./ActorBank/ActorBankView.jsx', () => ({
  default: ({ onWorkflowCharacterSelect }) => (
    <button
      type="button"
      data-testid="mock-bank-char"
      onClick={() => onWorkflowCharacterSelect?.({ charId: 'char_bank', source: 'actor-bank' })}
    >
      Pick bank character
    </button>
  ),
}))

afterEach(() => {
  cleanup()
})

const baseProps = {
  activeProjectId: 'proj_default',
  setActiveStep: vi.fn(),
  activeCharId: null,
  setActiveCharId: vi.fn(),
  activeEntityId: null,
  setActiveEntityId: vi.fn(),
  activeBankSlug: null,
  setActiveBankSlug: vi.fn(),
  onNext: vi.fn(),
  characters: {},
  setCharacters: vi.fn(),
  aiEngine: 'auto',
  localOnly: false,
  embeddedStatus: null,
  comfyStatus: null,
  comfyError: '',
}

describe('CastingStepContainer', () => {
  it('renders three sub-tabs with Casting Pipeline, Character Builder, and Actor Bank', () => {
    render(<CastingStepHarness {...baseProps} />)
    expect(screen.getByRole('tab', { name: /Casting Pipeline/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Character Builder/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Actor Bank/i })).toBeTruthy()
  })

  it('clicking each sub-tab shows the corresponding panel', () => {
    render(<CastingStepHarness {...baseProps} />)
    expect(screen.getByTestId('mock-pipeline-select')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /Character Builder/i }))
    expect(screen.getByTestId('mock-builder-char')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /Actor Bank/i }))
    expect(screen.getByTestId('mock-bank-char')).toBeTruthy()
  })

  it('character selection from each sub-tab updates workflow state setters', () => {
    const setActiveCharId = vi.fn()
    const setActiveEntityId = vi.fn()
    const setActiveBankSlug = vi.fn()
    render(
      <CastingStepHarness
        {...baseProps}
        setActiveCharId={setActiveCharId}
        setActiveEntityId={setActiveEntityId}
        setActiveBankSlug={setActiveBankSlug}
      />,
    )

    fireEvent.change(screen.getByTestId('mock-pipeline-select'), {
      target: { value: 'char_pipeline' },
    })
    expect(setActiveCharId).toHaveBeenCalledWith('char_pipeline')
    expect(setActiveBankSlug).toHaveBeenCalledWith('rita')

    setActiveCharId.mockClear()
    setActiveEntityId.mockClear()
    setActiveBankSlug.mockClear()
    fireEvent.change(screen.getByTestId('mock-workflow-select'), {
      target: { value: 'workflow-not-character' },
    })
    expect(setActiveCharId).not.toHaveBeenCalled()
    expect(setActiveEntityId).not.toHaveBeenCalled()
    expect(setActiveBankSlug).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('tab', { name: /Character Builder/i }))
    setActiveCharId.mockClear()
    setActiveEntityId.mockClear()
    setActiveBankSlug.mockClear()
    fireEvent.click(screen.getByTestId('mock-builder-char'))
    expect(setActiveCharId).toHaveBeenCalledWith('char_builder')
    expect(setActiveEntityId).toHaveBeenCalledWith('ent_builder')
    expect(setActiveBankSlug).toHaveBeenCalledWith('ivan')

    fireEvent.click(screen.getByRole('tab', { name: /Actor Bank/i }))
    setActiveCharId.mockClear()
    fireEvent.click(screen.getByTestId('mock-bank-char'))
    expect(setActiveCharId).toHaveBeenCalledWith('char_bank')
  })

  it('Next Step is disabled without activeCharId and calls onNext when enabled', () => {
    const onNext = vi.fn()
    const { rerender } = render(
      <CastingStepHarness {...baseProps} onNext={onNext} />,
    )
    const next = screen.getByRole('button', { name: /next step/i })
    expect(next.disabled).toBe(true)
    fireEvent.click(next)
    expect(onNext).not.toHaveBeenCalled()

    rerender(
      <CastingStepHarness {...baseProps} activeCharId="char_1" onNext={onNext} />,
    )
    expect(screen.getByRole('button', { name: /next step/i }).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /next step/i }))
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
