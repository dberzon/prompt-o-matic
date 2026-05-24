import { useEffect, useMemo, useState } from 'react'
import { getSnapshot, listSnapshots } from '../../lib/api/bibles.js'

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function deepSortKeys(value) {
  if (Array.isArray(value)) return value.map(deepSortKeys)
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = deepSortKeys(value[key])
        return acc
      }, /** @type {Record<string, unknown>} */ ({}))
  }
  return value
}

/**
 * @param {unknown} bibleJson
 */
function formatSnapshotPayload(bibleJson) {
  return JSON.stringify(deepSortKeys(bibleJson), null, 2)
}

/**
 * Minimal unified line diff (no external dependency).
 * @param {string} before
 * @param {string} after
 */
export function unifiedLineDiff(before, after) {
  if (before === after) return ''
  const a = before.split('\n')
  const b = after.split('\n')
  /** @type {string[]} */
  const out = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push(` ${a[i]}`)
      i += 1
      j += 1
    } else if (j < b.length && (i >= a.length || (i + 1 < a.length && a[i + 1] === b[j]))) {
      out.push(`+${b[j]}`)
      j += 1
    } else if (i < a.length) {
      out.push(`-${a[i]}`)
      i += 1
    } else {
      out.push(`+${b[j]}`)
      j += 1
    }
  }
  return out.join('\n')
}

/**
 * @param {import('../../lib/api/bibles.js').SnapshotRecord | null | undefined} a
 * @param {import('../../lib/api/bibles.js').SnapshotRecord | null | undefined} b
 */
export function diffSnapshots(a, b) {
  if (!a || !b) return ''
  if (a.id === b.id) return ''
  const left = formatSnapshotPayload(a.bibleJson)
  const right = formatSnapshotPayload(b.bibleJson)
  if (left === right) return ''
  return unifiedLineDiff(left, right)
}

/**
 * @param {import('../../lib/api/bibles.js').SnapshotRecord} snap
 */
function snapshotOptionLabel(snap) {
  const when = snap.createdAt ? new Date(snap.createdAt).toLocaleString() : 'unknown time'
  return `${snap.label} (${when})`
}

/**
 * @param {object} props
 * @param {string} props.entityId
 */
export default function SnapshotDiffView({ entityId }) {
  const [snapshots, setSnapshots] = useState(/** @type {import('../../lib/api/bibles.js').SnapshotRecord[]} */ ([]))
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState(/** @type {string | null} */ (null))
  const [snapshotAId, setSnapshotAId] = useState('')
  const [snapshotBId, setSnapshotBId] = useState('')
  const [snapshotA, setSnapshotA] = useState(/** @type {import('../../lib/api/bibles.js').SnapshotRecord | null} */ (null))
  const [snapshotB, setSnapshotB] = useState(/** @type {import('../../lib/api/bibles.js').SnapshotRecord | null} */ (null))
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    let cancelled = false
    setListLoading(true)
    setListError(null)
    listSnapshots(entityId)
      .then((items) => {
        if (cancelled) return
        setSnapshots(items)
      })
      .catch((err) => {
        if (cancelled) return
        setListError(err?.message || 'Failed to load snapshots')
        setSnapshots([])
      })
      .finally(() => {
        if (!cancelled) setListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [entityId])

  useEffect(() => {
    if (!snapshotAId || !snapshotBId) {
      setSnapshotA(null)
      setSnapshotB(null)
      setFetchError(null)
      setFetchLoading(false)
      return undefined
    }

    let cancelled = false
    setFetchLoading(true)
    setFetchError(null)

    Promise.all([getSnapshot(snapshotAId), getSnapshot(snapshotBId)])
      .then(([a, b]) => {
        if (cancelled) return
        setSnapshotA(a)
        setSnapshotB(b)
      })
      .catch((err) => {
        if (cancelled) return
        setSnapshotA(null)
        setSnapshotB(null)
        setFetchError(err?.message || 'Failed to load snapshot')
      })
      .finally(() => {
        if (!cancelled) setFetchLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [snapshotAId, snapshotBId])

  const diffText = useMemo(() => diffSnapshots(snapshotA, snapshotB), [snapshotA, snapshotB])

  const bothSelected = Boolean(snapshotAId && snapshotBId)

  return (
    <div data-testid="snapshot-diff-view">
      <h3>Snapshot diff</h3>

      {listLoading ? <p data-testid="snapshot-diff-list-loading">Loading snapshots…</p> : null}
      {listError ? (
        <p data-testid="snapshot-diff-list-error" role="alert">
          {listError}
        </p>
      ) : null}

      {!listLoading && !listError ? (
        <div data-testid="snapshot-diff-selectors">
          <label>
            Snapshot A{' '}
            <select
              data-testid="snapshot-diff-select-a"
              value={snapshotAId}
              onChange={(e) => setSnapshotAId(e.target.value)}
            >
              <option value="">Select…</option>
              {snapshots.map((snap) => (
                <option key={snap.id} value={snap.id}>
                  {snapshotOptionLabel(snap)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Snapshot B{' '}
            <select
              data-testid="snapshot-diff-select-b"
              value={snapshotBId}
              onChange={(e) => setSnapshotBId(e.target.value)}
            >
              <option value="">Select…</option>
              {snapshots.map((snap) => (
                <option key={snap.id} value={snap.id}>
                  {snapshotOptionLabel(snap)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {bothSelected && fetchLoading ? <p data-testid="snapshot-diff-fetch-loading">Loading snapshot payloads…</p> : null}
      {bothSelected && fetchError ? (
        <p data-testid="snapshot-diff-fetch-error" role="alert">
          {fetchError}
        </p>
      ) : null}

      {bothSelected && !fetchLoading && !fetchError ? (
        diffText ? (
          <pre data-testid="snapshot-diff-output">{diffText}</pre>
        ) : (
          <p data-testid="snapshot-diff-no-changes">No changes</p>
        )
      ) : null}
    </div>
  )
}
