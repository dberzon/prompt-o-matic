import { useState, useMemo, useEffect, useCallback } from 'react'
import { useProject } from './context/ProjectContext.jsx'
import { useWorkspace } from './context/WorkspaceContext.jsx'
import { useShareLink } from './context/ShareLinkContext.jsx'
import { useEmbeddedHealth } from './context/EmbeddedHealthContext.jsx'
import AppHeader from './components/AppHeader.jsx'
import NavigationStepper from './components/NavigationStepper.jsx'
import CastingStepContainer from './components/CastingStepContainer.jsx'
import BibleStepContainer from './components/BibleStepContainer.jsx'
import ExtrapolationStepContainer from './components/ExtrapolationStepContainer.jsx'
import PromptStudioStep from './components/PromptStudioStep.jsx'
import gateStyles from './components/AppHeader.module.css'
import CommandPalette from './components/CommandPalette.jsx'
import EmbeddedSetup from './components/EmbeddedSetup.jsx'
import styles from './App.module.css'

/** Minimal dev route shell until bead-18 expands DevDashboard.jsx */
function DevDashboard() {
  return (
    <div data-testid="dev-dashboard">
      <h1>Dev Dashboard</h1>
    </div>
  )
}

const STEP_PLACEHOLDER = {
  1: 'Casting',
  2: 'Bible',
  3: 'Extrapolation',
  4: 'Prompt Studio',
  5: 'Render',
  6: 'Portfolio',
}

const WORKFLOW_SUB_TABS = new Set(['casting-pipeline', 'character-builder', 'actor-bank'])

function normalizeWorkflowStep(value) {
  return Number.isInteger(value) && value >= 1 && value <= 6 ? value : 1
}

function normalizeWorkflowSubTab(value) {
  return WORKFLOW_SUB_TABS.has(value) ? value : 'casting-pipeline'
}

function normalizeNullableString(value) {
  return typeof value === 'string' || value === null ? value ?? null : null
}

export default function App() {
  if (typeof window !== 'undefined' && window.location.pathname === '/dev-dashboard') {
    return <DevDashboard />
  }

  const { active, setActiveById } = useProject()
  const activeProjectId = active?.id ?? null
  const ws = useWorkspace()
  const {
    handleShareState,
    registerWorkflowShareSource,
    subscribeWorkflowShareApply,
    workflowBootstrapFields,
  } = useShareLink()
  const { comfyStatus, comfyError, embeddedStatus, setEmbeddedStatus } = useEmbeddedHealth()
  const restoredWorkflowIds = ws.restoredWorkflowIds ?? {}
  const hasWorkflowShareHash = typeof window !== 'undefined' && window.location.hash.startsWith('#state=')

  const [activeStep, setActiveStep] = useState(() => normalizeWorkflowStep(restoredWorkflowIds.activeStep))
  const [activeSubTab, setActiveSubTab] = useState(() => normalizeWorkflowSubTab(restoredWorkflowIds.activeSubTab))
  const [activeCharId, setActiveCharId] = useState(() => normalizeNullableString(restoredWorkflowIds.activeCharId))
  const [activeEntityId, setActiveEntityId] = useState(() => normalizeNullableString(restoredWorkflowIds.activeEntityId))
  const [activeBankSlug, setActiveBankSlug] = useState(() => normalizeNullableString(restoredWorkflowIds.activeBankSlug))
  const [embeddedSetupOpen, setEmbeddedSetupOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const applyWorkflowFields = useCallback((fields) => {
    if (!fields || typeof fields !== 'object') return
    if (Number.isInteger(fields.step)) setActiveStep(normalizeWorkflowStep(fields.step))
    if (typeof fields.subTab === 'string') setActiveSubTab(normalizeWorkflowSubTab(fields.subTab))
    if (typeof fields.charId === 'string' || fields.charId === null) {
      setActiveCharId(fields.charId ?? null)
    }
    if (typeof fields.entityId === 'string' || fields.entityId === null) {
      setActiveEntityId(fields.entityId ?? null)
    }
    if (typeof fields.bankSlug === 'string' || fields.bankSlug === null) {
      setActiveBankSlug(fields.bankSlug ?? null)
    }
  }, [])

  useEffect(() => {
    const unregister = ws.registerWorkflowPersistSource(() => ({
      activeProjectId,
      activeCharId,
      activeEntityId,
      activeBankSlug,
      activeStep,
      activeSubTab,
    }))
    return unregister
  }, [
    ws.registerWorkflowPersistSource,
    activeProjectId,
    activeCharId,
    activeEntityId,
    activeBankSlug,
    activeStep,
    activeSubTab,
  ])

  useEffect(() => {
    const unregister = registerWorkflowShareSource(() => ({
      step: activeStep,
      projectId: activeProjectId,
      charId: activeCharId,
      entityId: activeEntityId,
      bankSlug: activeBankSlug,
    }))
    return unregister
  }, [
    registerWorkflowShareSource,
    activeProjectId,
    activeCharId,
    activeEntityId,
    activeBankSlug,
    activeStep,
  ])

  useEffect(() => {
    const unregister = subscribeWorkflowShareApply(applyWorkflowFields)
    return unregister
  }, [subscribeWorkflowShareApply, applyWorkflowFields])

  useEffect(() => {
    applyWorkflowFields(workflowBootstrapFields)
  }, [workflowBootstrapFields, applyWorkflowFields])

  const workflowProjectId = normalizeNullableString(
    workflowBootstrapFields
      ? workflowBootstrapFields.projectId
      : hasWorkflowShareHash
        ? null
        : restoredWorkflowIds.activeProjectId,
  )
  useEffect(() => {
    if (workflowProjectId && workflowProjectId !== activeProjectId) {
      setActiveById(workflowProjectId)
    }
  }, [workflowProjectId, activeProjectId, setActiveById])

  useEffect(() => {
    if (activeStep === 4) ws.fetchBankSlugs()
  }, [activeStep, ws.fetchBankSlugs])

  useEffect(() => {
    const onKey = (event) => {
      const mod = event.metaKey || event.ctrlKey
      if (!mod) return
      const key = event.key.toLowerCase()
      if (key === 'k') {
        event.preventDefault()
        setPaletteOpen((v) => !v)
      } else if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        ws.undo()
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault()
        ws.redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ws.undo, ws.redo])

  const commands = useMemo(() => [
    { id: 'undo', label: `Undo${ws.canUndo ? '' : ' (nothing to undo)'}`, run: ws.undo, disabled: !ws.canUndo },
    { id: 'redo', label: `Redo${ws.canRedo ? '' : ' (nothing to redo)'}`, run: ws.redo, disabled: !ws.canRedo },
    { id: 'reset', label: 'Reset all', run: ws.clearAll },
    { id: 'share', label: 'Copy share URL', run: () => { handleShareState() } },
    { id: 'save-profile', label: 'Save workspace profile', run: ws.saveProfile },
    {
      id: 'toggle-blend',
      label: ws.blendEnabled ? 'Disable director blend' : 'Enable director blend',
      run: () => ws.setBlendEnabled((v) => !v),
    },
  ], [
    ws.clearAll,
    handleShareState,
    ws.saveProfile,
    ws.blendEnabled,
    ws.undo,
    ws.redo,
    ws.canUndo,
    ws.canRedo,
    ws.setBlendEnabled,
  ])

  const stepPanel = (() => {
    if (activeStep === 1) {
      return (
        <CastingStepContainer
          activeProjectId={activeProjectId}
          activeSubTab={activeSubTab}
          setActiveSubTab={setActiveSubTab}
          setActiveStep={setActiveStep}
          activeCharId={activeCharId}
          setActiveCharId={setActiveCharId}
          activeEntityId={activeEntityId}
          setActiveEntityId={setActiveEntityId}
          activeBankSlug={activeBankSlug}
          setActiveBankSlug={setActiveBankSlug}
          onNext={() => setActiveStep(2)}
          characters={ws.characters}
          setCharacters={ws.setCharacters}
          aiEngine={ws.aiEngine}
          localOnly={ws.localOnly}
          embeddedStatus={embeddedStatus}
          comfyStatus={comfyStatus}
          comfyError={comfyError}
        />
      )
    }
    if (activeStep === 2) {
      return (
        <BibleStepContainer
          activeCharId={activeCharId}
          activeEntityId={activeEntityId}
          setActiveEntityId={setActiveEntityId}
          activeBankSlug={activeBankSlug}
          setActiveStep={setActiveStep}
          onNext={() => setActiveStep(3)}
          onPrev={() => setActiveStep(1)}
        />
      )
    }
    if (activeStep === 3) {
      return (
        <ExtrapolationStepContainer
          activeEntityId={activeEntityId}
          setActiveStep={setActiveStep}
          onNext={() => setActiveStep(4)}
          onPrev={() => setActiveStep(2)}
        />
      )
    }
    if (activeStep === 4) {
      return (
        <PromptStudioStep
          activeProjectId={activeProjectId}
          activeEntityId={activeEntityId}
          onNext={() => setActiveStep(5)}
          onPrev={() => setActiveStep(3)}
        />
      )
    }
    return (
      <div className={styles.characterTab} data-testid="step-panel">
        <p>{STEP_PLACEHOLDER[activeStep]}</p>
      </div>
    )
  })()

  const stepContent = (
    <>
      <NavigationStepper activeStep={activeStep} setActiveStep={setActiveStep} />
      {stepPanel}
    </>
  )

  return (
    <div className={styles.app}>
      <AppHeader onClear={ws.clearAll} comfyStatus={comfyStatus} comfyError={comfyError} />
      {activeProjectId == null ? (
        <div className={gateStyles.projectGateOverlay} role="dialog" aria-modal="true" aria-label="Project required">
          <p className={gateStyles.projectGateMessage}>
            Select or create a project to continue
          </p>
        </div>
      ) : (
        <div data-testid="step-content">
          {stepContent}
        </div>
      )}
      <EmbeddedSetup
        open={embeddedSetupOpen}
        onClose={() => setEmbeddedSetupOpen(false)}
        onStatusChange={setEmbeddedStatus}
      />
      <CommandPalette
        open={paletteOpen}
        commands={commands}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  )
}
