import { useRef, useState } from 'react'
import { apiPost } from '../lib/api/http.js'
import styles from './EntityExtrapolationPanel.module.css'

export default function EntityExtrapolationPanel({ entityId }) {
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const cancelledRef = useRef(false)

  const handleCancel = () => {
    cancelledRef.current = true
    setRunning(false)
    setStatus('Cancelled')
  }

  const handleRun = async () => {
    if (!entityId || running) return
    cancelledRef.current = false
    setRunning(true)
    setError('')
    setStage(0)
    setStatus('Starting extrapolation…')

    try {
      const result = await apiPost(`/api/extrapolate/character/${encodeURIComponent(entityId)}`, {})
      if (cancelledRef.current) return
      const stages = Array.isArray(result?.stages) ? result.stages : []
      setStage(stages.length || 6)
      setStatus(result?.cancelled
        ? 'Extrapolation cancelled.'
        : 'Extrapolation complete. Review inferred attributes below.')
    } catch (err) {
      setError(err?.message || 'Extrapolation failed')
      setStatus('')
    } finally {
      setRunning(false)
    }
  }

  if (!entityId) return null

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3 className={styles.title}>Run extrapolation</h3>
        <div className={styles.actions}>
          <button type="button" className={styles.runBtn} onClick={handleRun} disabled={running}>
            {running ? 'Running…' : 'Run pipeline'}
          </button>
          <button type="button" className={styles.cancelBtn} onClick={handleCancel} disabled={!running}>
            Cancel
          </button>
        </div>
      </div>
      {running || stage > 0 ? (
        <p className={styles.progress}>Stage {stage}/6</p>
      ) : null}
      {status ? <p className={styles.status}>{status}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  )
}
