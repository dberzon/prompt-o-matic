import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchBible } from '../lib/api/bibles.js'
import styles from './BibleQuickRef.module.css'

/** Same character bible leaf paths as bead-10 polish injection (projection output). */
const QUICKREF_PATHS = [
  'demographics.gender',
  'demographics.ageRange',
  'demographics.eraLabel',
  'demographics.housingNotes',
  'physical.height',
  'physical.build',
  'physical.face',
  'physical.eyes',
  'physical.nose',
  'physical.lips',
  'physical.skin',
  'wardrobe.everyday',
  'wardrobe.accessories',
  'voice.dialogueDeliveryNotes',
  'voice.accentOrDiction',
  'psychology.temperament',
  'psychology.motivations',
  'history.biographySummary',
  'history.educationOrWork',
  'history.habits',
  'visuals.portraitBrief',
  'visuals.continuityKeywords',
]

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isEmptyValue(value) {
  if (value == null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatDisplayValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join(', ')
  }
  return String(value).trim()
}

/**
 * @param {Record<string, unknown>} nested
 * @param {string} dotPath
 * @returns {unknown}
 */
function lookupPath(nested, dotPath) {
  const keys = dotPath.split('.').filter(Boolean)
  let cur = /** @type {unknown} */ (nested)
  for (const key of keys) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = /** @type {Record<string, unknown>} */ (cur)[key]
  }
  return cur
}

/**
 * @param {unknown} bible
 * @returns {{ path: string, value: string }[]}
 */
function bibleToRows(bible) {
  if (!bible || typeof bible !== 'object') return []
  const nested = /** @type {Record<string, unknown>} */ (bible)
  const rows = []
  for (const path of QUICKREF_PATHS) {
    const raw = lookupPath(nested, path)
    if (isEmptyValue(raw)) continue
    rows.push({ path, value: formatDisplayValue(raw) })
  }
  return rows
}

/**
 * @param {{ entityId?: string | null }} props
 */
export default function BibleQuickRef({ entityId = null }) {
  const [open, setOpen] = useState(true)
  const [rows, setRows] = useState(/** @type {{ path: string, value: string }[]} */ ([]))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(/** @type {string | null} */ (null))
  const [reloadKey, setReloadKey] = useState(0)

  const trimmedId = typeof entityId === 'string' ? entityId.trim() : ''

  const load = useCallback(async () => {
    if (!trimmedId) return
    setLoading(true)
    setError(null)
    try {
      const { bible } = await fetchBible(trimmedId)
      setRows(bibleToRows(bible))
    } catch (err) {
      setRows([])
      setError(err?.message || 'Unable to load Bible')
    } finally {
      setLoading(false)
    }
  }, [trimmedId])

  useEffect(() => {
    if (!trimmedId) {
      setRows([])
      setError(null)
      setLoading(false)
      return
    }
    load()
  }, [trimmedId, reloadKey, load])

  const panelId = useMemo(
    () => (trimmedId ? `bible-quickref-panel-${trimmedId.replace(/[^a-z0-9_-]/gi, '-')}` : 'bible-quickref-panel'),
    [trimmedId],
  )

  if (!trimmedId) return null

  return (
    <aside className={styles.root} data-testid="bible-quickref">
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide' : 'Show'} Character Bible
      </button>
      {open ? (
        <div id={panelId} className={styles.panel}>
          {loading ? <p className={styles.meta}>Loading bible…</p> : null}
          {error ? (
            <div className={styles.error}>
              <p>Unable to load Bible</p>
              <button type="button" className={styles.retryBtn} onClick={() => setReloadKey((k) => k + 1)}>
                Retry
              </button>
            </div>
          ) : null}
          {!loading && !error && rows.length === 0 ? (
            <p className={styles.meta}>No populated attributes yet.</p>
          ) : null}
          {!loading && !error && rows.length > 0 ? (
            <ul className={styles.list}>
              {rows.map((row) => (
                <li key={row.path} className={styles.row} data-testid="bible-quickref-row">
                  <span className={styles.path}>{row.path}</span>
                  <span className={styles.value}>{row.value}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
