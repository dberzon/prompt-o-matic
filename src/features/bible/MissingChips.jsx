import styles from './MissingChips.module.css'

/**
 * @typedef {import('../../lib/api/bibles.js').CompletenessReport} CompletenessReport
 */

const MAX_VISIBLE = 5

/**
 * @param {object} props
 * @param {CompletenessReport} props.report
 * @param {(section: string, field: string) => void} [props.onChipClick]
 */
export default function MissingChips({ report, onChipClick }) {
  const required = report.missingRequired ?? []
  const recommended = report.missingRecommended ?? []
  /** @type {{ section: string, field: string, tier: 'required' | 'recommended' }[]} */
  const items = [
    ...required.map((ref) => ({ ...ref, tier: /** @type {'required'} */ ('required') })),
    ...recommended.map((ref) => ({ ...ref, tier: /** @type {'recommended'} */ ('recommended') })),
  ]

  const visible = items.slice(0, MAX_VISIBLE)
  const overflow = items.length - MAX_VISIBLE

  if (items.length === 0) {
    return <div className={styles.row} data-testid="missing-chips-empty" />
  }

  return (
    <div className={styles.row} data-testid="missing-chips">
      {visible.map((ref, i) => {
        const label = ref.field ? `${ref.section} · ${ref.field}` : ref.section
        const tierClass = ref.tier === 'required' ? styles.chipRequired : styles.chipRecommended
        const interactive = typeof onChipClick === 'function'
        if (interactive) {
          return (
            <button
              key={`${ref.section}:${ref.field}:${ref.tier}:${i}`}
              type="button"
              className={`${styles.chip} ${tierClass} ${styles.chipButton}`}
              onClick={() => onChipClick(ref.section, ref.field)}
            >
              {label}
            </button>
          )
        }
        return (
          <span key={`${ref.section}:${ref.field}:${ref.tier}:${i}`} className={`${styles.chip} ${tierClass}`}>
            {label}
          </span>
        )
      })}
      {overflow > 0 ? <span className={styles.overflow}>+{overflow} more</span> : null}
    </div>
  )
}
