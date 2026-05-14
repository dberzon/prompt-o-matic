import styles from './AutofillStatusToast.module.css'

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {boolean} props.live
 * @param {Array<Record<string, unknown>>} props.events
 * @param {unknown} props.result
 * @param {string} props.streamStatus
 * @param {string} props.streamError
 * @param {string} props.streamWarning
 * @param {() => void} props.onDismiss
 */
export default function AutofillStatusToast({
  open,
  live,
  events,
  result,
  streamStatus,
  streamError,
  streamWarning,
  onDismiss,
}) {
  if (!open) return null

  let iteration = 0
  for (const ev of events) {
    if (ev?.type === 'iter:start' && typeof ev.iteration === 'number') {
      iteration = Math.max(iteration, ev.iteration)
    }
  }

  /** @type {string | undefined} */
  let terminationReason
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i]
    if (ev?.type === 'run:end' && typeof ev.terminationReason === 'string') {
      terminationReason = ev.terminationReason
      break
    }
  }

  const res =
    result && typeof result === 'object'
      ? /** @type {{ terminationReason?: string, iterations?: number }} */ (result)
      : null
  if (!terminationReason && typeof res?.terminationReason === 'string') {
    terminationReason = res.terminationReason
  }

  const busy = live && ['connecting', 'streaming', 'poll-fallback'].includes(streamStatus)
  const failed = streamStatus === 'error' || Boolean(streamError)

  let headline = 'Bible autofill'
  if (busy) {
    headline = iteration > 0 ? `Bible autofill · iteration ${iteration}` : 'Bible autofill · starting…'
  } else if (failed) {
    headline = 'Bible autofill failed'
  } else if (terminationReason) {
    headline = `Bible autofill · ${terminationReason}`
  } else if (!live && streamStatus === 'done') {
    headline = 'Bible autofill · finished'
  }

  const detailParts = []
  if (streamWarning) detailParts.push(streamWarning)
  if (failed && streamError) detailParts.push(streamError)
  if (!busy && typeof res?.iterations === 'number') {
    detailParts.push(`Iterations: ${res.iterations}`)
  }
  const detail = detailParts.filter(Boolean).join(' · ')

  return (
    <div
      className={styles.wrap}
      role="status"
      aria-live="polite"
      data-testid="T_AUTOFILL_TOAST"
      data-autofill-live={live ? '1' : '0'}
      data-autofill-termination={terminationReason ?? ''}
    >
      <div className={styles.body}>
        <strong className={styles.headline}>{headline}</strong>
        {detail ? <p className={styles.detail}>{detail}</p> : null}
      </div>
      <button type="button" className={styles.dismiss} onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}
