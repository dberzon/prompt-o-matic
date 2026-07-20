import { useCallback } from 'react'
import CastingPipelinePanel from './CastingPipelinePanel.jsx'
import CharacterBuilder from './CharacterBuilder.jsx'
import ActorBankView from './ActorBank/ActorBankView.jsx'
import styles from './CastingStepContainer.module.css'

const SUB_TABS = [
  { id: 'casting-pipeline', label: 'Casting Pipeline' },
  { id: 'character-builder', label: 'Character Builder' },
  { id: 'actor-bank', label: 'Actor Bank' },
]

/**
 * @param {{
 *   activeProjectId: string | null,
 *   activeCharId: string | null,
 *   setActiveCharId: (id: string | null) => void,
 *   activeEntityId: string | null,
 *   setActiveEntityId: (id: string | null) => void,
 *   activeBankSlug: string | null,
 *   setActiveBankSlug: (slug: string | null) => void,
 *   activeSubTab: 'casting-pipeline' | 'character-builder' | 'actor-bank',
 *   setActiveSubTab: (tab: 'casting-pipeline' | 'character-builder' | 'actor-bank') => void,
 *   setActiveStep: (step: number) => void,
 *   onNext: () => void,
 *   characters: Record<string, unknown>,
 *   setCharacters: (next: Record<string, unknown>) => void,
 *   aiEngine: string,
 *   localOnly: boolean,
 *   embeddedStatus: unknown,
 *   comfyStatus: unknown,
 *   comfyError: string,
 * }} props
 */
export default function CastingStepContainer({
  activeProjectId,
  activeCharId,
  setActiveCharId,
  activeEntityId,
  setActiveEntityId,
  activeBankSlug,
  setActiveBankSlug,
  activeSubTab,
  setActiveSubTab,
  setActiveStep,
  onNext,
  characters,
  setCharacters,
  aiEngine,
  localOnly,
  embeddedStatus,
  comfyStatus,
  comfyError,
}) {
  const applyCharacterSelection = useCallback(({
    charId,
    entityId = null,
    bankSlug = null,
    source,
  }) => {
    if (!charId) return
    setActiveCharId(charId)
    setActiveEntityId(entityId ?? null)
    if (bankSlug != null) {
      setActiveBankSlug(bankSlug)
    } else if (source !== 'character-builder') {
      setActiveBankSlug(null)
    }
  }, [setActiveCharId, setActiveEntityId, setActiveBankSlug])

  const handlePipelineSelectCapture = useCallback((event) => {
    const target = event.target
    if (!(target instanceof HTMLSelectElement)) return
    if (!target.value) return
    applyCharacterSelection({
      charId: target.value,
      source: 'casting-pipeline',
    })
  }, [applyCharacterSelection])

  const relayCharacterSelect = useCallback((payload) => {
    applyCharacterSelection(typeof payload === 'string'
      ? { charId: payload, source: 'actor-bank' }
      : payload)
  }, [applyCharacterSelection])

  return (
    <div className={styles.root}>
      <div className={styles.subTabs} role="tablist" aria-label="Casting step views">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeSubTab === tab.id}
            className={`${styles.subTab} ${activeSubTab === tab.id ? styles.subTabActive : ''}`}
            onClick={() => setActiveSubTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.panel}>
        {activeSubTab === 'casting-pipeline' && (
          <div
            className={styles.captureRoot}
            data-subtab="casting-pipeline"
            onChangeCapture={handlePipelineSelectCapture}
          >
            <CastingPipelinePanel
              jumpToCharacterId={activeSubTab === 'casting-pipeline' ? activeCharId : null}
              onJumpConsumed={() => {}}
              comfyStatus={comfyStatus}
              comfyError={comfyError}
            />
          </div>
        )}
        {activeSubTab === 'character-builder' && (
          <CharacterBuilder
            characters={characters}
            setCharacters={setCharacters}
            aiEngine={aiEngine}
            localOnly={localOnly}
            embeddedStatus={embeddedStatus}
            onOpenEntityEditor={(entityId) => {
              if (activeCharId) {
                setActiveEntityId(entityId)
              }
            }}
            onWorkflowCharacterSelect={relayCharacterSelect}
          />
        )}
        {activeSubTab === 'actor-bank' && (
          <ActorBankView
            setActiveCharId={setActiveCharId}
            setActiveStep={setActiveStep}
            setActiveSubTab={setActiveSubTab}
          />
        )}
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.nextBtn}
          disabled={!activeCharId}
          onClick={onNext}
        >
          Next Step
        </button>
        {activeProjectId ? (
          <span className={styles.selectionHint}>
            {activeCharId
              ? `Selected character: ${activeCharId.slice(0, 8)}…`
              : 'Select a character to continue'}
          </span>
        ) : null}
      </div>
    </div>
  )
}
