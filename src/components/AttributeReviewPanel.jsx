import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  dismissEntityAttribute,
  editEntityAttribute,
  listEntityAttributes,
  promoteEntityAttribute,
} from '../lib/api/entityAttributes.js'
import styles from './AttributeReviewPanel.module.css'

const REVIEW_PROVENANCES = new Set(['inferred', 'suggested', 'derived', 'temporary'])
const HISTORICAL_FACT_CHECK_STAGE = 2
const HISTORICAL_CONFIDENCE_CEILING = 0.6

function needsHistoricalFactReview(item) {
  if (!item || item.sourceStage !== HISTORICAL_FACT_CHECK_STAGE) return false
  if (item.provenance !== 'inferred' && item.provenance !== 'suggested') return false
  if (item.confidence === null || item.confidence === undefined) return true
  return item.confidence <= HISTORICAL_CONFIDENCE_CEILING
}

function formatValue(value) {
  if (value === null || value === undefined) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function keyPrefix(key) {
  const dot = String(key || '').indexOf('.')
  return dot >= 0 ? key.slice(0, dot) : 'general'
}

function groupAttributes(items) {
  const groups = new Map()
  for (const item of items) {
    const stage = item.sourceStage || 'unknown'
    const prefix = keyPrefix(item.key)
    const groupKey = `${stage}::${prefix}`
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { stage, prefix, items: [] })
    }
    groups.get(groupKey).items.push(item)
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (a.stage !== b.stage) return a.stage.localeCompare(b.stage)
    return a.prefix.localeCompare(b.prefix)
  })
}

export default function AttributeReviewPanel({ entityId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState('')
  const [draftValue, setDraftValue] = useState('')
  const [pendingId, setPendingId] = useState('')

  const loadAttributes = useCallback(async () => {
    if (!entityId) {
      setItems([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await listEntityAttributes(entityId)
      const all = Array.isArray(result?.items) ? result.items : []
      setItems(all.filter((item) => REVIEW_PROVENANCES.has(item.provenance)))
    } catch (err) {
      setError(err?.message || 'Failed to load attributes')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [entityId])

  useEffect(() => {
    void loadAttributes()
  }, [loadAttributes])

  const groups = useMemo(() => groupAttributes(items), [items])

  const runAction = async (attributeId, action) => {
    if (!entityId || pendingId) return
    setPendingId(attributeId)
    setError('')
    const previous = items
    try {
      if (action === 'promote') {
        setItems((current) => current.filter((item) => item.id !== attributeId))
        await promoteEntityAttribute(entityId, attributeId)
      } else if (action === 'dismiss') {
        setItems((current) => current.filter((item) => item.id !== attributeId))
        await dismissEntityAttribute(entityId, attributeId)
      } else if (action === 'edit') {
        setItems((current) => current.filter((item) => item.id !== attributeId))
        await editEntityAttribute(entityId, attributeId, draftValue)
        setEditingId('')
        setDraftValue('')
      }
      await loadAttributes()
    } catch (err) {
      setItems(previous)
      setError(err?.message || 'Attribute action failed')
    } finally {
      setPendingId('')
    }
  }

  if (!entityId) return null

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3 className={styles.title}>Attribute review</h3>
        <button type="button" className={styles.refreshBtn} onClick={() => loadAttributes()} disabled={loading}>
          Refresh
        </button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.status}>Loading attributes…</p> : null}
      {!loading && groups.length === 0 ? (
        <p className={styles.empty}>No inferred or suggested attributes awaiting review.</p>
      ) : null}
      {groups.map((group) => (
        <section key={`${group.stage}-${group.prefix}`} className={styles.group}>
          <header className={styles.groupHeader}>
            <span className={styles.groupStage}>Stage {group.stage}</span>
            <span className={styles.groupPrefix}>{group.prefix}</span>
          </header>
          <div className={styles.rows}>
            {group.items.map((item) => (
              <div key={item.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.key}>{item.key}</span>
                  <span className={styles.provenance}>{item.provenance}</span>
                  {item.confidence !== null && item.confidence !== undefined ? (
                    <span className={styles.confidence}>{Math.round(item.confidence * 100)}%</span>
                  ) : null}
                  {needsHistoricalFactReview(item) ? (
                    <span className={styles.historicalHint}>Verify historical detail</span>
                  ) : null}
                  {editingId === item.id ? (
                    <input
                      className={styles.editInput}
                      value={draftValue}
                      onChange={(event) => setDraftValue(event.target.value)}
                    />
                  ) : (
                    <span className={styles.value}>{formatValue(item.value)}</span>
                  )}
                </div>
                <div className={styles.actions}>
                  {editingId === item.id ? (
                    <>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => runAction(item.id, 'edit')}
                        disabled={pendingId === item.id}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtnGhost}
                        onClick={() => { setEditingId(''); setDraftValue('') }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => runAction(item.id, 'promote')}
                        disabled={pendingId === item.id}
                      >
                        Promote
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtnGhost}
                        onClick={() => {
                          setEditingId(item.id)
                          setDraftValue(formatValue(item.value))
                        }}
                        disabled={pendingId === item.id}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtnGhost}
                        onClick={() => runAction(item.id, 'dismiss')}
                        disabled={pendingId === item.id}
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
