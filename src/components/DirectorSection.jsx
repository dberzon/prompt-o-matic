import { useState } from 'react'
import { DIRECTORS, DIRECTOR_LIST } from '../data/directors.js'
import { getSceneBankEntry } from '../data/sceneBank.js'
import { getCharDesc } from '../utils/assembler.js'
import { useSectionState } from '../hooks/useSectionState.js'
import styles from './DirectorSection.module.css'

const GENDERS = ['man', 'woman', 'person']
const AGES = ['child', 'teen', '20s', '30s', '40s', '50s', '60s', 'elderly']

function buildBlendClauses(secondaryScenarios, secondaryNote = '') {
  const clausesFromScenarios = (secondaryScenarios ?? [])
    .map((s) => s.split(',').slice(0, 2).join(',').trim())
    .filter(Boolean)

  const noteClause = (secondaryNote ?? '')
    .split('.')
    .map((part) => part.trim())
    .find(Boolean)

  const unique = [...new Set(noteClause ? [...clausesFromScenarios, noteClause] : clausesFromScenarios)]
  return unique.length > 0 ? unique : ['secondary stylistic influence']
}

export default function DirectorSection({
  selectedDir,
  blendEnabled,
  blendDir,
  blendWeight,
  charCount,
  chars,
  scenario,
  narrativeBeat,
  useStyleKeyForPolish,
  onDirSelect,
  onBlendConfig,
  onCharCountChange,
  onCharChange,
  onScenarioSelect,
  onAppendScene,
  onNarrativeBeatChange,
  onUseStyleKeyForPolishChange,
}) {
  const [open, setOpen] = useSectionState('director-section', true)
  const [copiedSeedIdx, setCopiedSeedIdx] = useState(null)
  const panelId = 'director-section-panel'

  const copySeed = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedSeedIdx(idx)
      setTimeout(() => setCopiedSeedIdx(null), 1500)
    } catch {
      setCopiedSeedIdx(null)
    }
  }

  const dirData = selectedDir ? DIRECTORS[selectedDir] : null
  const blendData = blendDir ? DIRECTORS[blendDir] : null
  const bank = selectedDir ? getSceneBankEntry(selectedDir) : null

  const charDescs = Array.from({ length: charCount }, (_, i) =>
    getCharDesc(chars[i]?.g ?? 'person', chars[i]?.a ?? '30s')
  )

  const primaryScenarios = dirData ? dirData.s[charCount]?.(charDescs) ?? [] : []
  const secondaryScenarios = blendData ? blendData.s[charCount]?.(charDescs) ?? [] : []
  const blendClauses = buildBlendClauses(secondaryScenarios, blendData?.note)
  const scenarios = blendEnabled && blendData
    ? primaryScenarios.map((base, i) => {
      const secondaryClause = blendClauses[i % blendClauses.length]
      const baseLower = base.toLowerCase()
      if (baseLower.includes(secondaryClause.toLowerCase())) {
        return base
      }
      return `${base}, secondary register: ${secondaryClause}`
    })
    : primaryScenarios

  const selectedCount = (selectedDir ? 1 : 0) + (scenario ? 1 : 0)

  return (
    <div className={styles.section}>
      <button
        className={styles.sectionHead}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <div className={styles.headLeft}>
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>›</span>
          <span className={styles.sectionLabel}>Director + Characters + Interaction</span>
        </div>
        <span className={styles.badge}>
          {selectedDir
            ? `${DIRECTORS[selectedDir]?.short} · ${charCount}ch${scenario ? ' · scenario' : ''}`
            : 'none configured'}
        </span>
      </button>

      {open && (
        <div className={styles.sectionBody} id={panelId}>
          {/* Director grid */}
          <p className={styles.subLabel}>Director register</p>
          <div className={styles.dirGrid}>
            {DIRECTOR_LIST.map(key => (
              <button
                key={key}
                className={`${styles.dirChip} ${selectedDir === key ? styles.dirActive : ''}`}
                onClick={() => onDirSelect(key)}
                title={DIRECTORS[key].name}
              >
                {DIRECTORS[key].short}
              </button>
            ))}
          </div>

          {/* Director note */}
          {dirData && (
            <div className={styles.dirNote}>
              <span className={styles.dirNoteName}>{dirData.name}</span>
              <span className={styles.dirNoteText}>{dirData.note}</span>
            </div>
          )}

          {dirData && bank && (
            <div className={styles.sceneBankBlock}>
              <p className={styles.subLabel}>Scene bank (reference)</p>
              <div className={styles.styleKey}>
                <span className={styles.styleKeyLabel}>Style key</span>
                <span className={styles.styleKeyText}>{bank.styleKey}</span>
              </div>
              <p className={styles.compactLine} title="Fast cross-use">{bank.compact}</p>
              <label className={styles.bankToggle}>
                <input
                  type="checkbox"
                  checked={!!useStyleKeyForPolish}
                  onChange={(e) => onUseStyleKeyForPolishChange?.(e.target.checked)}
                />
                <span>Use style key as director note when polishing</span>
              </label>
            </div>
          )}

          {selectedDir && bank && charCount !== 2 && (
            <p className={styles.bankHint}>
              Scene seeds below are written for two characters — set count to 2 to browse them.
            </p>
          )}

          {selectedDir && bank && charCount === 2 && (
            <div className={styles.seedSection}>
              <p className={styles.subLabel}>Scene seeds (ideation, two figures)</p>
              {narrativeBeat && (
                <p className={styles.beatActive}>
                  Polish narrative beat set ({narrativeBeat.slice(0, 72)}
                  {narrativeBeat.length > 72 ? '…' : ''})
                  <button type="button" className={styles.beatClear} onClick={() => onNarrativeBeatChange?.(null)}>
                    Clear
                  </button>
                </p>
              )}
              <ul className={styles.seedList}>
                {bank.seeds2.map((seed, idx) => (
                  <li key={idx} className={styles.seedItem}>
                    <p className={styles.seedText}>{seed}</p>
                    <div className={styles.seedActions}>
                      <button
                        type="button"
                        className={styles.seedBtn}
                        onClick={() => copySeed(seed, idx)}
                      >
                        {copiedSeedIdx === idx ? 'Copied' : 'Copy'}
                      </button>
                      <button type="button" className={styles.seedBtn} onClick={() => onAppendScene?.(seed)}>
                        Append to scene
                      </button>
                      <button
                        type="button"
                        className={`${styles.seedBtn} ${narrativeBeat === seed ? styles.seedBtnActive : ''}`}
                        onClick={() => onNarrativeBeatChange?.(narrativeBeat === seed ? null : seed)}
                      >
                        {narrativeBeat === seed ? 'Beat active' : 'Set polish beat'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedDir && (
            <div className={styles.blendWrap}>
              <label className={styles.blendToggle}>
                <input
                  type="checkbox"
                  checked={blendEnabled}
                  onChange={(e) => onBlendConfig({ enabled: e.target.checked })}
                />
                <span>Enable director blend</span>
              </label>
              {blendEnabled && (
                <div className={styles.blendControls}>
                  <select
                    className={styles.charSelect}
                    value={blendDir ?? ''}
                    onChange={(e) => onBlendConfig({ dir: e.target.value || null })}
                  >
                    <option value="">Choose secondary director</option>
                    {DIRECTOR_LIST.filter((key) => key !== selectedDir).map((key) => (
                      <option key={key} value={key}>{DIRECTORS[key].short}</option>
                    ))}
                  </select>
                  <div className={styles.sliderRow}>
                    <span className={styles.sliderLabel}>
                      Weight {blendWeight}/{100 - blendWeight}
                    </span>
                    <input
                      className={styles.slider}
                      type="range"
                      min="50"
                      max="90"
                      step="5"
                      value={blendWeight}
                      onChange={(e) => onBlendConfig({ weight: Number(e.target.value) })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Character count */}
          <p className={styles.subLabel} style={{ marginTop: '16px' }}>Characters</p>
          <div className={styles.countRow}>
            <span className={styles.countLabel}>Count</span>
            {[1, 2, 3].map(n => (
              <button
                key={n}
                className={`${styles.countBtn} ${charCount === n ? styles.countActive : ''}`}
                onClick={() => onCharCountChange(n)}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Character config */}
          <div className={styles.charConfig}>
            {Array.from({ length: charCount }, (_, i) => (
              <div key={i} className={styles.charRow}>
                <span className={styles.charNum}>Character {i + 1}</span>
                <select
                  className={styles.charSelect}
                  value={chars[i]?.g ?? 'person'}
                  onChange={e => onCharChange(i, 'g', e.target.value)}
                >
                  {GENDERS.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <select
                  className={styles.charSelect}
                  value={chars[i]?.a ?? '30s'}
                  onChange={e => onCharChange(i, 'a', e.target.value)}
                >
                  {AGES.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Scenario list */}
          {dirData && scenarios.length > 0 && (
            <>
              <p className={styles.subLabel} style={{ marginTop: '16px' }}>
                Interaction scenario — pick one
              </p>
              <div className={styles.scenarioList}>
                {scenarios.map((s, i) => (
                  <button
                    key={i}
                    className={`${styles.scenarioCard} ${scenario === s ? styles.scenarioActive : ''}`}
                    onClick={() => onScenarioSelect(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
