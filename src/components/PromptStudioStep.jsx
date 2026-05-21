import { useRef } from 'react'
import { useWorkspace } from '../context/WorkspaceContext.jsx'
import { useShareLink } from '../context/ShareLinkContext.jsx'
import { useEmbeddedHealth } from '../context/EmbeddedHealthContext.jsx'
import { DIRECTORS } from '../data/directors.js'
import SceneInput from './SceneInput.jsx'
import SceneScaffold from './SceneScaffold.jsx'
import SceneDeck from './SceneDeck.jsx'
import SceneMatcher from './SceneMatcher.jsx'
import DirectorSection from './DirectorSection.jsx'
import ChipSection from './ChipSection.jsx'
import PromptOutput from './PromptOutput.jsx'
import MobilePromptBar from './MobilePromptBar.jsx'
import layoutStyles from '../App.module.css'
import styles from './PromptStudioStep.module.css'

/**
 * @param {{
 *   activeProjectId: string | null,
 *   activeEntityId: string | null,
 *   onNext: () => void,
 *   onPrev: () => void,
 * }} props
 */
export default function PromptStudioStep({
  activeProjectId: _activeProjectId,
  activeEntityId,
  onNext,
  onPrev,
}) {
  const ws = useWorkspace()
  const share = useShareLink()
  const health = useEmbeddedHealth()

  const matcherRef = useRef(null)
  const promptExportRef = useRef(null)

  const activeDirectorName = ws.selectedDir ? (DIRECTORS[ws.selectedDir]?.name ?? null) : null

  return (
    <div className={styles.root} data-testid="prompt-studio-step">
      <div className={`${layoutStyles.layout} ${styles.workspace}`}>
        <div className={layoutStyles.leftPanel}>
          <div className={layoutStyles.profileBar}>
            <div className={layoutStyles.historyGroup}>
              <button
                className={layoutStyles.profileBtn}
                onClick={ws.undo}
                disabled={!ws.canUndo}
                title="Undo (Ctrl/Cmd+Z)"
                aria-label="Undo"
              >
                ↶ Undo
              </button>
              <button
                className={layoutStyles.profileBtn}
                onClick={ws.redo}
                disabled={!ws.canRedo}
                title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)"
                aria-label="Redo"
              >
                ↷ Redo
              </button>
            </div>
            <button className={layoutStyles.profileBtn} onClick={ws.saveProfile}>Save profile</button>
            <select
              className={layoutStyles.profileSelect}
              value={ws.aiEngine}
              onChange={(e) => ws.setAiEngine(e.target.value)}
              title="AI engine for polish"
            >
              <option value="auto">AI: Auto</option>
              <option value="embedded">AI: Embedded</option>
              <option value="local">AI: Local</option>
              <option value="cloud">AI: Cloud</option>
            </select>
            <span
              className={`${layoutStyles.statusDot} ${health.embeddedStatus?.running ? layoutStyles.statusDotReady : layoutStyles.statusDotIdle}`}
              title={health.embeddedStatus?.running ? 'Embedded runtime ready' : 'Embedded runtime not running'}
            />
            <label className={layoutStyles.profileCheck}>
              <input
                type="checkbox"
                checked={ws.localOnly}
                onChange={(e) => ws.setLocalOnly(e.target.checked)}
                disabled={ws.aiEngine === 'cloud'}
              />
              Local only
            </label>
            <select
              className={layoutStyles.profileSelect}
              value={ws.selectedProfile}
              onChange={(e) => ws.setSelectedProfile(e.target.value)}
            >
              <option value="">Select profile...</option>
              {Object.entries(ws.profiles).map(([key, profile]) => (
                <option key={key} value={key}>{profile.label}</option>
              ))}
            </select>
            <button
              className={layoutStyles.profileBtn}
              onClick={() => ws.selectedProfile && ws.loadProfile(ws.selectedProfile)}
              disabled={!ws.selectedProfile}
            >
              Load
            </button>
            <button
              className={layoutStyles.profileBtn}
              onClick={() => ws.selectedProfile && ws.deleteProfile(ws.selectedProfile)}
              disabled={!ws.selectedProfile}
            >
              Delete
            </button>
          </div>

          <SceneInput value={ws.scene} onChange={ws.setScene} availableSlugs={ws.availableSlugs} />
          <SceneScaffold charCount={ws.charCount} chars={ws.chars} onApply={ws.applyScaffold} />
          <SceneDeck onApply={ws.applyDeck} selectedDir={ws.selectedDir} />
          <SceneMatcher onApply={ws.applyMatch} matcherRef={matcherRef} />

          <DirectorSection
            selectedDir={ws.selectedDir}
            blendEnabled={ws.blendEnabled}
            blendDir={ws.blendDir}
            blendWeight={ws.blendWeight}
            charCount={ws.charCount}
            chars={ws.chars}
            scenario={ws.scenario}
            narrativeBeat={ws.narrativeBeat}
            useStyleKeyForPolish={ws.useStyleKeyForPolish}
            onDirSelect={ws.handleDirSelect}
            onBlendConfig={ws.handleBlendConfig}
            bankChars={ws.bankCharsForSelector}
            onCharCountChange={ws.handleCharCount}
            onCharChange={ws.handleCharChange}
            onScenarioSelect={ws.handleScenario}
            onAppendScene={ws.appendScene}
            onNarrativeBeatChange={ws.setNarrativeBeat}
            onUseStyleKeyForPolishChange={ws.setUseStyleKeyForPolish}
            customDirectors={ws.customDirectors}
            onSaveCustomDirector={ws.saveCustomDirector}
            onDeleteCustomDirector={ws.deleteCustomDirector}
          />

          <ChipSection
            chips={ws.chips}
            onToggle={ws.toggleChip}
            onMergeChips={ws.mergeChips}
            onPreset={ws.loadPreset}
            selectedDir={ws.selectedDir}
            onApplySelectedDirectorPreset={ws.applySelectedDirectorPreset}
            lastAppliedPresetLabel={ws.lastAppliedPresetLabel}
            customPresets={ws.customPresets}
            onSaveCustomPreset={ws.saveCustomPreset}
            onExportCustomPresets={ws.exportCustomPresets}
            onImportCustomPresets={ws.importCustomPresets}
          />
        </div>

        <div className={layoutStyles.rightPanel}>
          <PromptOutput
            prompt={ws.prompt}
            scene={ws.scene}
            scenario={ws.scenario}
            chips={ws.chips}
            variants={ws.variants}
            issues={ws.issues}
            onApplyRuleFix={ws.applyRuleFixById}
            onShareState={share.handleShareState}
            directorName={activeDirectorName}
            directorNote={ws.polishDirectorNote}
            narrativeBeat={ws.narrativeBeat}
            applyDiff={ws.applyDiff}
            isApplyDiffPinned={ws.isApplyDiffPinned}
            onPinApplyDiff={ws.setIsApplyDiffPinned}
            onClearApplyDiff={() => {
              ws.setApplyDiff(null)
              ws.setIsApplyDiffPinned(false)
            }}
            exportFilenameBase={ws.exportFilenameBase}
            promptExportRef={promptExportRef}
            aiEngine={ws.aiEngine}
            localOnly={ws.localOnly}
            embeddedStatus={health.embeddedStatus}
            comfyStatus={health.comfyStatus}
            comfyError={health.comfyError}
            entityId={activeEntityId || undefined}
          />
        </div>

        <MobilePromptBar
          displayText={ws.assembledText}
          hasContent={ws.hasContent}
        />
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.navBtn} onClick={onPrev}>
          Previous Step
        </button>
        <button type="button" className={styles.nextBtn} onClick={onNext}>
          Next Step
        </button>
      </div>
    </div>
  )
}
