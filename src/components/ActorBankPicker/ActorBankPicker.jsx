import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './ActorBankPicker.module.css'

export default function ActorBankPicker({ characters = [], onSelect, onClose, excludeIds = [] }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return characters
    return characters.filter(c => (c.name ?? '').toLowerCase().includes(q))
  }, [characters, query])

  const excluded = useMemo(() => new Set(excludeIds.filter(Boolean)), [excludeIds])

  return (
    <div className={styles.popover} role="dialog" aria-label="Pick character from Actor Bank">
      <input
        ref={inputRef}
        className={styles.search}
        placeholder="Search by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className={styles.list}>
        {filtered.length === 0 && (
          <div className={styles.empty}>No characters match.</div>
        )}
        {filtered.map((c) => {
          const isExcluded = excluded.has(c.id)
          return (
            <button
              key={c.id}
              type="button"
              className={`${styles.row} ${isExcluded ? styles.rowDisabled : ''}`}
              onClick={() => { if (!isExcluded) onSelect?.(c) }}
              disabled={isExcluded}
            >
              {c.thumbnailUrl ? (
                <img src={c.thumbnailUrl} alt="" className={styles.thumb} />
              ) : (
                <span className={styles.thumbPlaceholder} aria-hidden>·</span>
              )}
              <span className={styles.rowName}>{c.name ?? 'Unnamed'}</span>
              <span className={styles.rowMeta}>
                {typeof c.age === 'number' ? c.age : '—'} · {(c.genderPresentation ?? '?').slice(0, 1).toUpperCase()}
              </span>
              {isExcluded && <span className={styles.rowAlready}>(already cast)</span>}
            </button>
          )
        })}
      </div>
      <div className={styles.footer}>
        <button type="button" className={styles.cancel} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
