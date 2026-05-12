import { useCallback, useEffect, useState } from 'react'
import { getEntityAttributeHistory } from '../lib/api/entityAttributes.js'
import styles from './AttributeHistoryPanel.module.css'

function formatValue(value) {
  if (value === null || value === undefined) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function formatTimestamp(value) {
  if (!value) return 'Unknown time'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

export default function AttributeHistoryPanel({ entityId, attributeId, attributeKey }) {
  const [items, setItems] = useState([])
  const [currentAttributeId, setCurrentAttributeId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadHistory = useCallback(async () => {
    if (!entityId || !attributeId) {
      setItems([])
      setCurrentAttributeId('')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await getEntityAttributeHistory(entityId, attributeId)
      setItems(Array.isArray(result?.items) ? result.items : [])
      setCurrentAttributeId(result?.currentAttributeId || '')
    } catch (err) {
      setError(err?.message || 'Failed to load attribute history')
      setItems([])
      setCurrentAttributeId('')
    } finally {
      setLoading(false)
    }
  }, [attributeId, entityId])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  return (
    <div className={styles.wrap}>
      <h4 className={styles.title}>History for {attributeKey}</h4>
      {loading ? <p className={styles.status}>Loading history…</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {!loading && !error && items.length === 0 ? (
        <p className={styles.empty}>No history recorded for this attribute.</p>
      ) : null}
      {items.length > 0 ? (
        <ol className={styles.timeline}>
          {items.map((item) => (
            <li
              key={item.id}
              className={`${styles.entry} ${item.id === currentAttributeId ? styles.entryCurrent : ''}`}
            >
              <div className={styles.meta}>
                <span>{item.provenance}</span>
                {item.sourceStage ? <span>stage {item.sourceStage}</span> : null}
                <span>{formatTimestamp(item.createdAt)}</span>
                {item.id === currentAttributeId ? <span>current</span> : null}
              </div>
              <div className={styles.value}>{formatValue(item.value)}</div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
