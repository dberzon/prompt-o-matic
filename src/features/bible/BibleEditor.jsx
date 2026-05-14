import { useCallback, useEffect, useMemo, useState } from 'react'
import AttributeReviewPanel from '../../components/AttributeReviewPanel.jsx'
import EntityConflictPanel from '../../components/EntityConflictPanel.jsx'
import { approveBibleSection, fetchBible, fetchBibleCompleteness } from '../../lib/api/bibles.js'
import { listEntityAttributes } from '../../lib/api/entityAttributes.js'
import { detectBibleRootSchema, stripProvenance } from '../../../api/lib/bibles/detectRootSchema.js'
import BibleSectionPanel from './BibleSectionPanel.jsx'
import CompletenessRing from './CompletenessRing.jsx'
import {
  listBibleObjectSectionEntries,
  provenanceForSectionFields,
} from './bibleObjectSections.js'
import styles from './BibleEditor.module.css'

/**
 * @param {unknown[]} items
 * @returns {Record<string, 'approved' | 'rejected' | 'pending'>}
 */
function parseBibleApprovalStates(items) {
  /** @type {Record<string, 'approved' | 'rejected' | 'pending'>} */
  const out = {}
  if (!Array.isArray(items)) return out
  const seenKeys = new Set()
  for (const item of items) {
    const k = item?.key
    if (typeof k !== 'string' || !k.startsWith('_approval.')) continue
    if (seenKeys.has(k)) continue
    seenKeys.add(k)
    const section = k.slice('_approval.'.length)
    if (!section) continue
    const v = item?.value
    const state =
      v && typeof v === 'object' && v.state === 'approved'
        ? 'approved'
        : v && typeof v === 'object' && v.state === 'rejected'
          ? 'rejected'
          : 'pending'
    out[section] = state
  }
  return out
}

/**
 * @param {object} props
 * @param {string} [props.entityId]
 */
export default function BibleEditor({ entityId }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bundle, setBundle] = useState(null)

  const load = useCallback(async () => {
    if (!entityId) {
      setBundle(null)
      setError('')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [bibleRes, report, attrRes] = await Promise.all([
        fetchBible(entityId),
        fetchBibleCompleteness(entityId),
        listEntityAttributes(entityId),
      ])
      const bibleRaw = bibleRes?.bible
      if (!bibleRaw || typeof bibleRaw !== 'object') {
        throw new Error('Invalid bible response')
      }
      const bible = /** @type {Record<string, unknown>} */ (stripProvenance(bibleRaw))
      const rootSchema = detectBibleRootSchema(bible)
      const sectionEntries = listBibleObjectSectionEntries(rootSchema)
      const flatProv =
        bibleRes?.provenance && typeof bibleRes.provenance === 'object'
          ? /** @type {Record<string, unknown>} */ (bibleRes.provenance)
          : {}
      const approvals = parseBibleApprovalStates(attrRes?.items)
      setBundle({ bible, provenance: flatProv, report, sectionEntries, approvals })
    } catch (err) {
      setBundle(null)
      setError(err instanceof Error ? err.message : 'Failed to load bible')
    } finally {
      setLoading(false)
    }
  }, [entityId])

  useEffect(() => {
    void load()
  }, [load])

  const sectionEntries = bundle?.sectionEntries ?? []
  const approvals = bundle?.approvals ?? {}

  const handleApprove = useCallback(
    async (sectionKey) => {
      if (!entityId) return
      try {
        await approveBibleSection(entityId, sectionKey)
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Approve failed')
      }
    },
    [entityId, load],
  )

  const noopOnChange = useCallback((_field, _value) => {}, [])

  const panels = useMemo(
    () =>
      sectionEntries.map(({ key, sectionSchema }) => {
        const secValues =
          bundle?.bible && typeof bundle.bible[key] === 'object' && bundle.bible[key] !== null
            ? /** @type {Record<string, unknown>} */ (bundle.bible[key])
            : {}
        const approvalState = approvals[key] ?? 'pending'
        const provSlice = provenanceForSectionFields(bundle?.provenance ?? {}, key)
        return (
          <BibleSectionPanel
            key={key}
            sectionName={key}
            sectionSchema={sectionSchema}
            values={secValues}
            provenance={provSlice}
            approvalState={approvalState}
            onChange={noopOnChange}
            onApprove={() => {
              void handleApprove(key)
            }}
          />
        )
      }),
    [approvals, bundle?.bible, bundle?.provenance, handleApprove, noopOnChange, sectionEntries],
  )

  if (!entityId) {
    return <p className={styles.empty}>Select an entity to open the Bible editor.</p>
  }

  if (loading && !bundle) {
    return (
      <p className={styles.status} data-testid="T_BIBLE_EDITOR_LOADING">
        Loading bible…
      </p>
    )
  }

  if (error && !bundle) {
    return (
      <p className={styles.error} data-testid="T_BIBLE_EDITOR_ERROR">
        {error}
      </p>
    )
  }

  if (!bundle) {
    return (
      <p className={styles.empty} data-testid="T_BIBLE_EDITOR_ERROR">
        Bible not available.
      </p>
    )
  }

  return (
    <div className={styles.wrap} data-testid="T_BIBLE_EDITOR">
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Bible</h2>
          <p className={styles.subtitle}>{entityId}</p>
        </div>
      </header>

      {error ? (
        <p className={styles.error} data-testid="T_BIBLE_EDITOR_INLINE_ERROR">
          {error}
        </p>
      ) : null}

      <div className={styles.topRow}>
        <CompletenessRing report={bundle.report} />
      </div>

      {loading ? <p className={styles.status}>Refreshing…</p> : null}

      <div className={styles.sectionGrid}>{panels}</div>

      <AttributeReviewPanel entityId={entityId} />
      <EntityConflictPanel entityId={entityId} />
    </div>
  )
}
