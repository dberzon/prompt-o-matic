import { formatExtrapolationDropSummary, useExtrapolation } from '../hooks/useExtrapolation.js'
import styles from './EntityExtrapolationPanel.module.css'

export default function EntityExtrapolationPanel({ entityId }) {
  const { run, cancel, running, stage, status, error, result } = useExtrapolation({ entityId })
  const dropSummary = formatExtrapolationDropSummary(result?.stages)

  if (!entityId) return null

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3 className={styles.title}>Run extrapolation</h3>
        <div className={styles.actions}>
          <button type="button" className={styles.runBtn} onClick={() => run()} disabled={running}>
            {running ? 'Running…' : 'Run pipeline'}
          </button>
          <button type="button" className={styles.cancelBtn} onClick={cancel} disabled={!running}>
            Cancel
          </button>
        </div>
      </div>
      {running || stage > 0 ? (
        <p className={styles.progress}>Stage {stage}/6</p>
      ) : null}
      {status ? <p className={styles.status}>{status}</p> : null}
      {dropSummary ? <p className={styles.drops}>{dropSummary}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  )
}
