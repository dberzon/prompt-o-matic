import { useCallback, useEffect, useMemo, useState } from 'react'
import { dismissEntityConflict, resolveEntityConflict } from '../lib/api/entityConflicts.js'
import { listEntityAttributes } from '../lib/api/entityAttributes.js'
import styles from './EntityConflictPanel.module.css'

function formatValue(value) {
  if (value === null || value === undefined) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function parseConflictValue(value) {
  let payload = value || {}
  if (typeof value === 'string') {
    try {
      payload = JSON.parse(value)
    } catch {
      payload = { message: value }
    }
  }
  return {
    message: payload?.message || 'Conflict detected',
    attributeIds: Array.isArray(payload?.attributeIds) ? payload.attributeIds : [],
  }
}

function isConflictMarker(item) {
  return item?.sourceStage === 6
    && item?.provenance === 'suggested'
    && String(item?.key || '').startsWith('conflict.')
    && !item?.dismissedAt
}

export default function EntityConflictPanel({ entityId }) {
  const [attributes, setAttributes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState('')
  const [selectedWinnerByConflict, setSelectedWinnerByConflict] = useState({})

  const loadConflicts = useCallback(async () => {
    if (!entityId) {
      setAttributes([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await listEntityAttributes(entityId)
      setAttributes(Array.isArray(result?.items) ? result.items : [])
    } catch (err) {
      setError(err?.message || 'Failed to load conflicts')
      setAttributes([])
    } finally {
      setLoading(false)
    }
  }, [entityId])

  useEffect(() => {
    void loadConflicts()
  }, [loadConflicts])

  const attributeById = useMemo(
    () => new Map(attributes.map((item) => [item.id, item])),
    [attributes],
  )

  const conflicts = useMemo(
    () => attributes.filter(isConflictMarker),
    [attributes],
  )

  const runResolve = async (conflictId) => {
    const winningAttributeId = selectedWinnerByConflict[conflictId]
    if (!entityId || !winningAttributeId || pendingId) return
    setPendingId(conflictId)
    setError('')
    try {
      await resolveEntityConflict(entityId, conflictId, winningAttributeId)
      await loadConflicts()
    } catch (err) {
      setError(err?.message || 'Failed to resolve conflict')
    } finally {
      setPendingId('')
    }
  }

  const runDismiss = async (conflictId) => {
    if (!entityId || pendingId) return
    setPendingId(conflictId)
    setError('')
    try {
      await dismissEntityConflict(entityId, conflictId)
      await loadConflicts()
    } catch (err) {
      setError(err?.message || 'Failed to dismiss conflict')
    } finally {
      setPendingId('')
    }
  }

  if (!entityId) return null

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3 className={styles.title}>Stage 6 conflicts</h3>
        <button type="button" className={styles.refreshBtn} onClick={() => loadConflicts()} disabled={loading}>
          Refresh
        </button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.status}>Loading conflicts…</p> : null}
      {!loading && conflicts.length === 0 ? (
        <p className={styles.empty}>No S6 conflicts awaiting review.</p>
      ) : null}
      {conflicts.map((conflict) => {
        const { message, attributeIds } = parseConflictValue(conflict.value)
        const selectedWinner = selectedWinnerByConflict[conflict.id] || attributeIds[0] || ''
        return (
          <article key={conflict.id} className={styles.card}>
            <p className={styles.message}>{message}</p>
            <div className={styles.candidates}>
              {attributeIds.map((attributeId) => {
                const attribute = attributeById.get(attributeId)
                return (
                  <label key={attributeId} className={styles.candidate}>
                    <input
                      type="radio"
                      name={`conflict-${conflict.id}`}
                      value={attributeId}
                      checked={selectedWinner === attributeId}
                      onChange={() => {
                        setSelectedWinnerByConflict((current) => ({
                          ...current,
                          [conflict.id]: attributeId,
                        }))
                      }}
                    />
                    <span className={styles.candidateKey}>{attribute?.key || attributeId}</span>
                    <span className={styles.candidateValue}>{formatValue(attribute?.value)}</span>
                  </label>
                )
              })}
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => runResolve(conflict.id)}
                disabled={!selectedWinner || pendingId === conflict.id}
              >
                Keep selected
              </button>
              <button
                type="button"
                className={styles.actionBtnGhost}
                onClick={() => runDismiss(conflict.id)}
                disabled={pendingId === conflict.id}
              >
                Dismiss
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
