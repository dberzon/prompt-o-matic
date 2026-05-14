import styles from './CompletenessRing.module.css'

/**
 * @typedef {import('../../lib/api/bibles.js').CompletenessReport} CompletenessReport
 */

/**
 * @param {object} props
 * @param {CompletenessReport} props.report
 * @param {number} [props.size]
 */
export default function CompletenessRing({ report, size = 120 }) {
  const half = size / 2
  const stroke = Math.max(3, size * 0.075)
  const radius = Math.max(4, half - stroke * 1.25)
  const circ = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, Number.isFinite(report.ratio) ? report.ratio : 0))
  const pct = Math.round(clamped * 100)

  const reqTotal = report.requiredCount ?? 0
  const recTotal = report.recommendedCount ?? 0
  const reqDone = report.presentRequired ?? 0
  const recDone = report.presentRecommended ?? 0

  const ariaParts = [
    `Completeness ${pct} percent`,
    reqTotal > 0 ? `${reqDone} of ${reqTotal} required fields filled` : 'no required fields in schema',
    recTotal > 0 ? `${recDone} of ${recTotal} recommended fields filled` : 'no recommended fields in schema',
  ]
  const ariaLabel = ariaParts.join('. ') + '.'

  const reqLegend = reqTotal > 0 ? `Required ${reqDone}/${reqTotal}` : 'Required (none)'
  const recLegend = recTotal > 0 ? `Recommended ${recDone}/${recTotal}` : 'Recommended (none)'

  return (
    <div className={styles.wrap}>
      <svg
        className={styles.svg}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel}
      >
        <title>{ariaLabel}</title>
        <g transform={`rotate(-90 ${half} ${half})`}>
          <circle fill="none" stroke="#2a3340" strokeWidth={stroke} r={radius} cx={half} cy={half} />
          <circle
            data-testid="completeness-ratio-arc"
            fill="none"
            stroke="#5b8fc7"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={circ * (1 - clamped)}
            r={radius}
            cx={half}
            cy={half}
          />
        </g>
        <text className={styles.center} x={half} y={half + stroke * 0.15}>
          {pct}%
        </text>
      </svg>
      <div className={styles.legend} aria-hidden="true">
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchRequired}`} />
          {reqLegend}
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchRecommended}`} />
          {recLegend}
        </span>
      </div>
    </div>
  )
}
