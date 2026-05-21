import { useMemo } from 'react'
import { useExtrapolationStream } from '../hooks/useExtrapolationStream.js'
import EntityExtrapolationPanel from './EntityExtrapolationPanel.jsx'
import AttributeReviewPanel from './AttributeReviewPanel.jsx'
import EntityConflictPanel from './EntityConflictPanel.jsx'
import EntityContinuityQaPanel from './EntityContinuityQaPanel.jsx'
import styles from './ExtrapolationStepContainer.module.css'

/**
 * @param {{
 *   activeEntityId: string | null,
 *   setActiveStep: (step: number) => void,
 *   onNext: () => void,
 *   onPrev: () => void,
 * }} props
 */
export default function ExtrapolationStepContainer({
  activeEntityId,
  setActiveStep,
  onNext,
  onPrev,
}) {
  if (!activeEntityId) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>
          <p>Lift a character to Bible Context in Step 2 first.</p>
          <button type="button" className={styles.linkBtn} onClick={() => setActiveStep(2)}>
            Go to Bible
          </button>
        </div>
        <StepFooter onPrev={onPrev} onNext={onNext} nextDisabled />
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.workspace}>
        <div className={styles.leftCol}>
          <EntityExtrapolationPanel entityId={activeEntityId} />
          <ExtrapolationStreamLog runId={null} />
        </div>
        <div className={styles.rightCol}>
          <AttributeReviewPanel entityId={activeEntityId} />
          <EntityConflictPanel entityId={activeEntityId} />
          <EntityContinuityQaPanel entityId={activeEntityId} entityType="character" />
        </div>
      </div>
      <StepFooter onPrev={onPrev} onNext={onNext} />
    </div>
  )
}

function ExtrapolationStreamLog({ runId }) {
  const stream = useExtrapolationStream(runId)
  const lines = useMemo(() => {
    if (!Array.isArray(stream.events) || stream.events.length === 0) return []
    return stream.events.map((event, index) => {
      const type = typeof event?.type === 'string' ? event.type : 'event'
      const stage = event?.stage != null ? ` stage ${event.stage}` : ''
      return `${index + 1}. ${type}${stage}`
    })
  }, [stream.events])

  return (
    <section className={styles.streamLog} aria-label="Extrapolation stream log">
      <h4 className={styles.streamLogTitle}>Stream log</h4>
      {runId ? (
        <p className={styles.streamMeta}>
          Run {runId.slice(0, 8)}… · {stream.status}
        </p>
      ) : (
        <p className={styles.streamIdle}>Stage events appear here when a pipeline run is active.</p>
      )}
      {stream.error ? <p className={styles.streamError}>{stream.error}</p> : null}
      {stream.warning ? <p className={styles.streamWarning}>{stream.warning}</p> : null}
      {lines.length > 0 ? (
        <ol className={styles.streamList}>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}

function StepFooter({ onPrev, onNext, nextDisabled = false }) {
  return (
    <div className={styles.footer}>
      <button type="button" className={styles.navBtn} onClick={onPrev}>
        Previous Step
      </button>
      <button
        type="button"
        className={styles.nextBtn}
        disabled={nextDisabled}
        onClick={onNext}
      >
        Next Step
      </button>
    </div>
  )
}
