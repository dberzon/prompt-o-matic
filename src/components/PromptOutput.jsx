import { useState, useCallback, useEffect, useMemo } from 'react'
import { NEGATIVE_PROMPT } from '../data/chips.js'
import { usePolish } from '../hooks/usePolish.js'
import { scorePromptQuality } from '../utils/qualityScore.js'
import { downloadPromptTxt } from '../utils/downloadPromptFile.js'
import styles from './PromptOutput.module.css'

const DEFAULT_FRONT_PREFIX = 'photorealistic film still'
const HISTORY_KEY = 'qpb_prompt_history_v1'
const HISTORY_LIMIT = 12

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function CopyButton({ text, label = 'Copy' }) {
  const [state, setState] = useState('idle')

  const handleCopy = useCallback(async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2000)
    }
  }, [text])

  return (
    <button
      className={`${styles.copyBtn} ${state === 'copied' ? styles.copied : ''}`}
      onClick={handleCopy}
      disabled={!text}
    >
      {state === 'copied' ? '✓ Copied' : state === 'error' ? 'Failed' : label}
    </button>
  )
}

export default function PromptOutput({
  prompt, // string[] — assembled from chips
  scene, // string — raw scene input
  scenario, // string | null — selected scenario
  chips = {},
  variants = [],
  issues = [],
  onApplyRuleFix,
  onShareState,
  directorName, // string | null — e.g. "Andrei Tarkovsky"
  directorNote, // string | null — director register line for polish (note or style key)
  narrativeBeat = null, // string | null — ideation seed passed to polish as narrative context
  applyDiff = null, // {source, timestamp, changes:[{kind,text}]} | null
  isApplyDiffPinned = false,
  onPinApplyDiff,
  onClearApplyDiff,
  exportFilenameBase = 'qwen-prompt',
  promptExportRef, // optional ref object: { current: null | () => void } for command palette export
  aiEngine = 'auto',
  localOnly = false,
  embeddedStatus = null,
}) {
  const [showNeg, setShowNeg] = useState(false)
  const [useFrontPrefix, setUseFrontPrefix] = useState(true)
  const [showVariants, setShowVariants] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [restoredText, setRestoredText] = useState(null)
  const [history, setHistory] = useState(() => readHistory())
  const [showHistory, setShowHistory] = useState(false)
  const [diffTargetId, setDiffTargetId] = useState(null)
  const [shareState, setShareState] = useState('idle')
  const [showQualityHints, setShowQualityHints] = useState(false)
  const [health, setHealth] = useState(null)
  const [healthError, setHealthError] = useState('')
  const { state, polished, error, polish, revert, checkHealth } = usePolish()

  const hasContent = prompt.length > 0
  const isAssembled = !!(scene?.trim() || scenario)
  const isPolished = state === 'polished' && polished
  const hasVariantOverride = !!selectedVariant
  const assembledText = prompt.join(', ')

  // What we actually display and copy
  const displayText = restoredText
    ? restoredText
    : hasVariantOverride
    ? selectedVariant.text
    : isPolished
      ? polished
      : assembledText
  const displayFragments = restoredText
    ? [restoredText]
    : hasVariantOverride
    ? [selectedVariant.text]
    : isPolished
    ? [polished] // show as one block when polished
    : prompt // show as individual fragments when assembled

  const qualityReport = useMemo(
    () => scorePromptQuality({
      assembledText: displayText,
      chips,
      scenario,
      scene,
    }),
    [displayText, chips, scenario, scene],
  )

  useEffect(() => {
    if (!promptExportRef) return
    promptExportRef.current = () => {
      downloadPromptTxt({
        positive: displayText,
        negative: NEGATIVE_PROMPT,
        filenameBase: exportFilenameBase,
      })
    }
    return () => {
      promptExportRef.current = null
    }
  }, [displayText, exportFilenameBase, promptExportRef])

  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        const info = await checkHealth({
          engine: aiEngine,
          localOnly,
          embeddedPort: embeddedStatus?.port ?? null,
          embeddedSecret: embeddedStatus?.secret ?? null,
        })
        if (!active) return
        setHealth(info)
        setHealthError('')
      } catch (err) {
        if (!active) return
        setHealth(null)
        setHealthError(err?.message ?? 'Health check failed')
      }
    }
    run()
    return () => { active = false }
  }, [aiEngine, localOnly, embeddedStatus, checkHealth])

  const handleExportTxt = useCallback(() => {
    downloadPromptTxt({
      positive: displayText,
      negative: NEGATIVE_PROMPT,
      filenameBase: exportFilenameBase,
    })
  }, [displayText, exportFilenameBase])

  const handlePolish = () => {
    setRestoredText(null)
    polish({
      fragments: prompt,
      directorName,
      directorNote,
      scene,
      scenario,
      frontPrefix: useFrontPrefix ? DEFAULT_FRONT_PREFIX : '',
      narrativeBeat,
      engine: aiEngine,
      localOnly,
      embeddedPort: embeddedStatus?.port ?? null,
      embeddedSecret: embeddedStatus?.secret ?? null,
    })
  }

  const pushHistory = useCallback((kind, text) => {
    const value = (text ?? '').trim()
    if (!value) return
    setHistory((prev) => {
      const deduped = prev.filter((entry) => entry.text !== value)
      const next = [{
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind,
        text: value,
        timestamp: Date.now(),
      }, ...deduped].slice(0, HISTORY_LIMIT)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  useEffect(() => {
    if (assembledText.trim()) pushHistory('assembled', assembledText)
  }, [assembledText, pushHistory])

  useEffect(() => {
    if (isPolished && polished) pushHistory('polished', polished)
  }, [isPolished, polished, pushHistory])

  useEffect(() => {
    if (selectedVariant?.text) pushHistory('variant', selectedVariant.text)
  }, [selectedVariant, pushHistory])

  const diffTarget = history.find((entry) => entry.id === diffTargetId) ?? null
  const diffData = useMemo(() => {
    if (!diffTarget) return null
    const currentTokens = new Set(displayText.split(/\s+/).filter(Boolean))
    const targetTokens = new Set(diffTarget.text.split(/\s+/).filter(Boolean))
    const removed = [...currentTokens].filter((t) => !targetTokens.has(t)).slice(0, 25)
    const added = [...targetTokens].filter((t) => !currentTokens.has(t)).slice(0, 25)
    return { removed, added }
  }, [diffTarget, displayText])

  const handleShare = async () => {
    if (!onShareState) return
    try {
      await onShareState()
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 2000)
    } catch {
      setShareState('error')
      setTimeout(() => setShareState('idle'), 2000)
    }
  }

  // Status badge
  const badge = hasVariantOverride
    ? { label: `variant: ${selectedVariant.label}`, cls: styles.statusPolished }
    : restoredText
    ? { label: 'restored', cls: styles.statusPolished }
    : isPolished
    ? { label: 'AI polished', cls: styles.statusPolished }
    : isAssembled
      ? { label: 'assembled', cls: styles.statusOk }
      : hasContent
        ? { label: 'chips only', cls: styles.statusRaw }
        : null

  return (
    <div className={styles.wrap}>
      {/* Header row */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerLabel}>Prompt</span>
          {badge && (
            <span className={`${styles.statusBadge} ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={`${styles.copyBtn} ${shareState === 'copied' ? styles.copied : ''}`}
            onClick={handleShare}
            disabled={!hasContent}
            title="Copies a shareable URL with your full workspace encoded in the page fragment."
          >
            {shareState === 'copied' ? '✓ Link copied' : shareState === 'error' ? 'Failed' : 'Copy share link'}
          </button>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={handleExportTxt}
            disabled={!displayText.trim()}
            title="Download positive prompt plus NEGATIVE block as a .txt file."
          >
            Export .txt
          </button>
          <CopyButton text={displayText} />
        </div>
      </div>

      {hasContent && (
        <div className={styles.qualityRow}>
          <button
            type="button"
            className={styles.qualitySummary}
            onClick={() => setShowQualityHints((v) => !v)}
            aria-expanded={showQualityHints}
          >
            <span className={styles.qualityLabel}>Quality</span>
            <span className={styles.qualityScore}>{qualityReport.overall}</span>
            <span className={styles.qualityHintToggle}>{showQualityHints ? 'Hide' : 'Details'}</span>
          </button>
          {showQualityHints && (
            <ul className={styles.qualityList}>
              {qualityReport.breakdown.map((row) => (
                <li key={row.key} className={styles.qualityItem}>
                  <span className={styles.qualityItemLabel}>{row.label}</span>
                  <span className={styles.qualityItemScore}>
                    {row.score}/{row.max}
                  </span>
                  {row.hint ? <span className={styles.qualityItemHint}>{row.hint}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {applyDiff?.changes?.length > 0 && (
        <div className={styles.applyDiffBox}>
          <div className={styles.applyDiffHeader}>
            <div className={styles.applyDiffHeaderLeft}>
              <span className={styles.applyDiffTitle}>Last apply changes</span>
              <span className={styles.applyDiffMeta}>
                {applyDiff.source} · {new Date(applyDiff.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className={styles.applyDiffActions}>
              <button
                type="button"
                className={`${styles.diffTinyBtn} ${isApplyDiffPinned ? styles.diffTinyBtnActive : ''}`}
                onClick={() => onPinApplyDiff?.(!isApplyDiffPinned)}
                title={isApplyDiffPinned ? 'Unpin diff (allow updates)' : 'Pin diff (freeze this snapshot)'}
              >
                {isApplyDiffPinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                type="button"
                className={styles.diffTinyBtn}
                onClick={() => onClearApplyDiff?.()}
                title="Clear apply diff panel"
              >
                Clear
              </button>
            </div>
          </div>
          <ul className={styles.applyDiffList}>
            {applyDiff.changes.map((change, idx) => (
              <li key={`${applyDiff.id}-${idx}`} className={styles.applyDiffItem}>
                {change.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Prompt display */}
      <div className={`${styles.promptBox} ${isAssembled || isPolished ? styles.promptBoxActive : ''} ${isPolished ? styles.promptBoxPolished : ''}`}>
        {hasContent ? (
          <div className={styles.promptParts}>
            {isPolished ? (
              <span className={styles.partText}>{polished}</span>
            ) : (
              displayFragments.map((part, i) => (
                <span key={i} className={styles.promptPart}>
                  <span className={styles.partText}>{part}</span>
                  {i < displayFragments.length - 1 && (
                    <span className={styles.comma}>, </span>
                  )}
                </span>
              ))
            )}
          </div>
        ) : (
          <p className={styles.placeholder}>
            Configure directors and characters, then add technical chips…
          </p>
        )}
      </div>

      {issues.length > 0 && (
        <div className={styles.rulePanel}>
          {issues.map((issue) => (
            <div key={issue.id} className={styles.ruleItem}>
              <span className={styles.ruleText}>{issue.message}</span>
              <button
                className={styles.ruleFixBtn}
                onClick={() => onApplyRuleFix?.(issue.id)}
              >
                {issue.fixLabel}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {state === 'error' && error && (
        <div className={styles.errorMsg}>
          ✕ {error}
        </div>
      )}

      {healthError ? (
        <p className={styles.engineHint}>Engine check failed: {healthError}</p>
      ) : (
        <p className={styles.engineHint}>
          {health?.provider === 'local'
            ? health?.local?.installed
              ? 'Using local Ollama model.'
              : 'Ollama is running, but model missing. Run: ollama pull qwen2.5:7b-instruct'
            : health?.provider === 'embedded'
              ? health?.embedded?.ready
                ? 'Using embedded sidecar model.'
                : 'Embedded model loading...'
            : health?.fallback && !localOnly
              ? 'Local unavailable; automatically falling back to cloud.'
              : localOnly
                ? 'Local-only mode active. Cloud fallback disabled.'
              : 'Using cloud provider.'}
        </p>
      )}

      {/* Polish / Revert buttons */}
      <div className={styles.prefixRow}>
        <label className={styles.prefixToggle}>
          <input
            type="checkbox"
            checked={useFrontPrefix}
            onChange={(e) => setUseFrontPrefix(e.target.checked)}
            disabled={state === 'loading'}
          />
          <span>Use film-still prefix</span>
        </label>
        <code className={styles.prefixValue}>{DEFAULT_FRONT_PREFIX}</code>
      </div>

      {narrativeBeat?.trim() && (
        <p className={styles.narrativeHint}>
          Narrative beat active for polish — API distills it to one static instant (no dialogue in output).
        </p>
      )}

      <div className={styles.polishRow}>
        {isPolished ? (
          <button className={styles.revertBtn} onClick={revert}>
            ↩ Revert to assembled
          </button>
        ) : (
          <button
            className={`${styles.polishBtn} ${state === 'loading' ? styles.polishLoading : ''}`}
            onClick={handlePolish}
            disabled={!hasContent || state === 'loading'}
          >
            {state === 'loading' ? (
              <>
                <span className={styles.spinner} />
                Polishing…
              </>
            ) : (
              '✦ Polish with AI'
            )}
          </button>
        )}
        {isPolished && (
          <button
            className={styles.repolishBtn}
            onClick={handlePolish}
            disabled={state === 'loading'}
          >
            {state === 'loading' ? 'Polishing…' : 'Re-polish'}
          </button>
        )}
      </div>

      <div className={styles.variantRow}>
        <button
          className={styles.revertBtn}
          onClick={() => setShowVariants((v) => !v)}
          disabled={!hasContent}
        >
          {showVariants ? 'Hide variants' : 'Generate variants'}
        </button>
        {selectedVariant && (
          <button className={styles.repolishBtn} onClick={() => setSelectedVariant(null)}>
            Clear variant
          </button>
        )}
        {restoredText && (
          <button className={styles.repolishBtn} onClick={() => setRestoredText(null)}>
            Clear restore
          </button>
        )}
      </div>
      {showVariants && variants.length > 0 && (
        <div className={styles.variantList}>
          {variants.map((variant) => (
            <button
              key={variant.id}
              className={styles.variantCard}
              onClick={() => setSelectedVariant(variant)}
            >
              <span className={styles.variantTitle}>{variant.label}</span>
              <span className={styles.variantText}>{variant.text}</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.historyWrap}>
        <button
          className={styles.revertBtn}
          onClick={() => setShowHistory((v) => !v)}
          disabled={history.length === 0}
        >
          {showHistory ? 'Hide history' : `Prompt history (${history.length})`}
        </button>
        {showHistory && (
          <div className={styles.historyList}>
            {history.map((entry) => (
              <div key={entry.id} className={styles.historyItem}>
                <div className={styles.historyMeta}>
                  <span>{entry.kind}</span>
                  <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className={styles.historyText}>{entry.text}</p>
                <div className={styles.historyActions}>
                  <button className={styles.ruleFixBtn} onClick={() => setDiffTargetId(entry.id)}>
                    Diff
                  </button>
                  <button
                    className={styles.ruleFixBtn}
                    onClick={() => {
                      setRestoredText(entry.text)
                      setSelectedVariant(null)
                    }}
                  >
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {diffData && (
        <div className={styles.diffBox}>
          <p className={styles.tipsTitle}>Diff vs current output</p>
          <p className={styles.diffRemoved}>Removed: {diffData.removed.join(' ') || '—'}</p>
          <p className={styles.diffAdded}>Added: {diffData.added.join(' ') || '—'}</p>
        </div>
      )}

      {/* Aspect ratio reminder */}
      {hasContent && (
        <div className={styles.arReminder}>
          <span className={styles.arLabel}>Append →</span>
          <code className={styles.arCode}>--ar 2.35:1</code>
          <span className={styles.arOr}>or</span>
          <code className={styles.arCode}>--ar 16:9</code>
        </div>
      )}

      {/* Negative prompt */}
      <div className={styles.negSection}>
        <div className={styles.negHeader}>
          <button
            className={styles.negToggle}
            onClick={() => setShowNeg(o => !o)}
          >
            <span className={`${styles.chevron} ${showNeg ? styles.chevronOpen : ''}`}>›</span>
            <span>Negative prompt</span>
          </button>
          <CopyButton text={NEGATIVE_PROMPT} label="Copy neg" />
        </div>
        {showNeg && (
          <div className={styles.negBox}>
            {NEGATIVE_PROMPT}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className={styles.tips}>
        <p className={styles.tipsTitle}>How to use</p>
        <ul className={styles.tipsList}>
          <li>Pick a director → set characters → choose a scenario</li>
          <li>Add environment, light, palette, and film chips</li>
          <li>Describe your scene in the field above (optional)</li>
          <li>Hit <strong>Polish with AI</strong> to fuse fragments into a unified prompt</li>
          <li>Copy and paste into Qwen — append aspect ratio</li>
        </ul>
      </div>
    </div>
  )
}
