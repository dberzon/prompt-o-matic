import { useEffect, useState } from 'react'
import { listEntities } from '../lib/api/entities.js'
import EntityEditor from './EntityEditor.jsx'
import styles from './EntityContinuityPanel.module.css'

export default function EntityContinuityPanel({ initialEntityId = '' }) {
  const [entities, setEntities] = useState([])
  const [selectedEntityId, setSelectedEntityId] = useState(initialEntityId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialEntityId) {
      setSelectedEntityId(initialEntityId)
    }
  }, [initialEntityId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    listEntities()
      .then((result) => {
        if (cancelled) return
        const items = Array.isArray(result?.items) ? result.items : []
        setEntities(items)
        if (!selectedEntityId && items[0]?.id) {
          setSelectedEntityId(items[0].id)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message || 'Failed to load entities')
        setEntities([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Continuity</h2>
          <p className={styles.subtitle}>Generate or choose the primary visual anchor for an entity.</p>
        </div>
        <label className={styles.selector}>
          <span className={styles.selectorLabel}>Entity</span>
          <select
            value={selectedEntityId}
            onChange={(event) => setSelectedEntityId(event.target.value)}
            disabled={loading || entities.length === 0}
          >
            {entities.length === 0 ? <option value="">No entities</option> : null}
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name || entity.id}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <EntityEditor entityId={selectedEntityId} onEntityChange={setSelectedEntityId} />
    </div>
  )
}
