import styles from './CharacterCard.module.css'

const LIFECYCLE_LABELS = {
  draft: 'draft',
  auditioned: 'auditioned',
  portfolio_pending: 'portfolio pending',
  ready: 'ready',
  finalized: 'finalized',
}

const RENDER_STATUS_LABEL = { pending: '⏳ rendering…', success: '✓ ready', failed: '✗ failed' }

/**
 * Unified character profile card.
 *
 * Props:
 *   mode             — 'audition' | 'batch' | 'preview' | 'bank' (default: 'batch')
 *   character        — profile object (name, age, cinematicArchetype, etc.)
 *   lifecycleStatus  — optional enum value from CharacterProfileSchema
 *   previewImageUrl  — optional thumbnail image URL
 *   classificationLabel — string shown only in batch mode (similarity / review status)
 *   renderStatus     — { status, imageUrl } shown in audition/preview modes
 *   actions          — array of { label, onClick, disabled?, variant?, key? }
 *   actionError      — optional error string shown below actions
 *   dimmed           — if true, renders at reduced opacity
 *   children         — additional content rendered below actions
 */
export default function CharacterCard({
  mode = 'batch',
  character,
  lifecycleStatus,
  previewImageUrl,
  classificationLabel,
  classificationLabelVariant,
  renderStatus,
  actions = [],
  actionError,
  actionHint,
  dimmed = false,
  children,
}) {
  const profile = character || {}
  const { name, age, cinematicArchetype, personalityEnergy, faceShape, eyes, hairColor, hairLength, visualKeywords } = profile

  const visTraits = [
    faceShape && `face: ${faceShape}`,
    eyes && `eyes: ${eyes}`,
    hairColor && hairLength ? `hair: ${hairColor} ${hairLength}` : (hairColor || hairLength || null),
  ].filter(Boolean).slice(0, 3)

  const keywords = Array.isArray(visualKeywords) ? visualKeywords.slice(0, 4) : []

  const showClassTag = mode === 'batch' && classificationLabel
  const showRenderStatus = (mode === 'audition' || mode === 'preview') && renderStatus

  return (
    <div className={styles.card} data-dimmed={dimmed ? 'true' : undefined}>
      {/* Header: name + age + status badge */}
      <div className={styles.header}>
        <span className={styles.name}>{name || '(unnamed)'}</span>
        {age != null && <span className={styles.age}>{age} y/o</span>}
        {lifecycleStatus && lifecycleStatus !== 'draft' && (
          <span className={`${styles.statusBadge} ${styles[`badge-${lifecycleStatus}`] || ''}`}>
            {LIFECYCLE_LABELS[lifecycleStatus] || lifecycleStatus}
          </span>
        )}
      </div>

      {/* Body: optional image + profile text */}
      <div className={styles.bodyRow}>
        {previewImageUrl && (
          <img className={styles.preview} src={previewImageUrl} alt={name || 'character'} />
        )}
        {showRenderStatus && renderStatus.imageUrl && (
          <img className={styles.preview} src={renderStatus.imageUrl} alt={name || 'character'} />
        )}
        <div className={styles.profileBlock}>
          {cinematicArchetype && <div className={styles.archetype}>{cinematicArchetype}</div>}
          {personalityEnergy && <div className={styles.energy}>{personalityEnergy}</div>}
          {(visTraits.length > 0 || keywords.length > 0) && (
            <div className={styles.traits}>
              {visTraits.map((t) => <span key={t} className={styles.chip}>{t}</span>)}
              {keywords.map((k) => <span key={k} className={styles.chip}>{k}</span>)}
            </div>
          )}
          {showClassTag && (
            <div className={styles.classTag} data-variant={classificationLabelVariant || undefined}>{classificationLabel}</div>
          )}
          {showRenderStatus && (
            <div className={styles.renderStatus} data-status={renderStatus.status || 'pending'}>
              {RENDER_STATUS_LABEL[renderStatus.status] || '⏳ queued'}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map((a, i) => (
            <button
              key={a.key ?? i}
              type="button"
              className={styles.actionBtn}
              data-variant={a.variant || undefined}
              disabled={a.disabled}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
          {actionError && <span className={styles.actionError}>{actionError}</span>}
          {actionHint && <span className={styles.actionHint}>{actionHint}</span>}
        </div>
      )}

      {/* Slot for extra content (e.g. MoreTakesPanel) */}
      {children}
    </div>
  )
}
