import { useRef, useState } from 'react'
import { apiPost } from '../lib/api/http.js'
import styles from './EntityExtrapolationPanel.module.css'

const STAGE_COUNT = 6

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
      for (let current = 1; current <= STAGE_COUNT; current += 1) {
        if (cancelledRef.current) return
        setStage(current)
        setStatus(`Running stage ${current}/${STAGE_COUNT}…`)
        if (current === 5) {
          await apiPost(`/api/entities/${encodeURIComponent(entityId)}/extrapolate/stage/5`, {})
        } else {
          await new Promise((resolve) => setTimeout(resolve, 250))
        }
      }
      setStatus('Extrapolation complete. Review inferred attributes below.')
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
        <p className={styles.progress}>Stage {stage}/{STAGE_COUNT}</p>
      ) : null}
      {status ? <p className={styles.status}>{status}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  )
}
