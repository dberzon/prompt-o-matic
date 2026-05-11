import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  editEntityAttribute,
  listEntityAttributes,
} from '../lib/api/entityAttributes.js'
import styles from './CanonAttributesPanel.module.css'

function formatValue(value) {
  if (value === null || value === undefined) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function keyPrefix(key) {
  const dot = String(key || '').indexOf('.')
  return dot >= 0 ? key.slice(0, dot) : 'general'
}

function groupCanonAttributes(items) {
  const groups = new Map()
  for (const item of items) {
    const prefix = keyPrefix(item.key)
    if (!groups.has(prefix)) groups.set(prefix, { prefix, items: [] })
    groups.get(prefix).items.push(item)
  }
  return Array.from(groups.values()).sort((a, b) => a.prefix.localeCompare(b.prefix))
}

export default function CanonAttributesPanel({ entityId, sectionPrefix = null }) {
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
      const result = await listEntityAttributes(entityId, { provenance: 'canon' })
      const all = Array.isArray(result?.items) ? result.items : []
      setItems(all)
    } catch (err) {
      setError(err?.message || 'Failed to load canon attributes')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [entityId])

  useEffect(() => {
    void loadAttributes()
  }, [loadAttributes])

  const groups = useMemo(() => {
    const grouped = groupCanonAttributes(items)
    if (!sectionPrefix) return grouped
    const needle = sectionPrefix.toLowerCase()
    return grouped.filter((group) => group.prefix.toLowerCase() === needle
      || group.items.some((item) => String(item.key || '').toLowerCase().startsWith(`${needle}.`)
        || String(item.key || '').toLowerCase() === needle))
  }, [items, sectionPrefix])

  const saveEdit = async (attributeId) => {
    if (!entityId || pendingId) return
    setPendingId(attributeId)
    setError('')
    try {
      await editEntityAttribute(entityId, attributeId, draftValue)
      setEditingId('')
      setDraftValue('')
      await loadAttributes()
    } catch (err) {
      setError(err?.message || 'Canon edit failed')
    } finally {
      setPendingId('')
    }
  }

  if (!entityId) return null

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3 className={styles.title}>Canon attributes</h3>
        <button type="button" className={styles.refreshBtn} onClick={() => loadAttributes()} disabled={loading}>
          Refresh
        </button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.status}>Loading canon attributes…</p> : null}
      {!loading && groups.length === 0 ? (
        <p className={styles.empty}>No canon attributes yet.</p>
      ) : null}
      {groups.map((group) => (
        <section key={group.prefix} className={styles.group}>
          <header className={styles.groupHeader}>
            <span className={styles.groupPrefix}>{group.prefix}</span>
          </header>
          <div className={styles.rows}>
            {group.items.map((item) => (
              <div key={item.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.key}>{item.key}</span>
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
                        onClick={() => saveEdit(item.id)}
                        disabled={pendingId === item.id}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtnGhost}
                        onClick={() => {
                          setEditingId('')
                          setDraftValue('')
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => {
                        setEditingId(item.id)
                        setDraftValue(formatValue(item.value))
                      }}
                    >
                      Edit
                    </button>
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
