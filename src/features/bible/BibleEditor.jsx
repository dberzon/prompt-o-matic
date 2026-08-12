import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AutofillStatusToast from '../../components/AutofillStatusToast.jsx'
import AttributeReviewPanel from '../../components/AttributeReviewPanel.jsx'
import EntityConflictPanel from '../../components/EntityConflictPanel.jsx'
import { useExtrapolationStream } from '../../hooks/useExtrapolationStream.js'
import { startAutofillBible } from '../../lib/api/agentsAutofill.js'
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
 * @typedef {null | { phase: 'live', runId: string } | { phase: 'summary', events: Array<Record<string, unknown>>, result: unknown, streamError: string, streamWarning: string, streamStatus: string }} AutofillUiState
 */

/**
 * @param {object} props
 * @param {string} [props.entityId]
 */
export default function BibleEditor({ entityId }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bundle, setBundle] = useState(null)
  /** @type {[AutofillUiState, import('react').Dispatch<import('react').SetStateAction<AutofillUiState>>]} */
  const [autofillUi, setAutofillUi] = useState(/** @type {AutofillUiState} */ (null))
  const entityIdRef = useRef(entityId)
  entityIdRef.current = entityId
  /** Bumped on entity change / unmount so in-flight loads cannot commit stale bundles. */
  const loadGenRef = useRef(0)

  const autofillRunId = autofillUi?.phase === 'live' ? autofillUi.runId : null
  const stream = useExtrapolationStream(autofillRunId)

  const load = useCallback(async () => {
    const requestedEntityId = entityIdRef.current
    const loadGen = ++loadGenRef.current
    if (!requestedEntityId) {
      setBundle(null)
      setError('')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [bibleRes, report, attrRes] = await Promise.all([
        fetchBible(requestedEntityId),
        fetchBibleCompleteness(requestedEntityId),
        listEntityAttributes(requestedEntityId),
      ])
      if (loadGen !== loadGenRef.current || requestedEntityId !== entityIdRef.current) return
      const bibleRaw = bibleRes?.bible
      if (!bibleRaw || typeof bibleRaw !== 'object') {
        throw new Error('Invalid bible response')
      }
      const bible = /** @type {Record<string, unknown>} */ (stripProvenance(bibleRaw))
      const entityType =
        typeof bibleRes?.entityType === 'string' ? bibleRes.entityType : undefined
      const rootSchema = detectBibleRootSchema(bible, entityType)
      const sectionEntries = listBibleObjectSectionEntries(rootSchema)
      const flatProv =
        bibleRes?.provenance && typeof bibleRes.provenance === 'object'
          ? /** @type {Record<string, unknown>} */ (bibleRes.provenance)
          : {}
      const approvals = parseBibleApprovalStates(attrRes?.items)
      setBundle({ bible, provenance: flatProv, report, sectionEntries, approvals })
    } catch (err) {
      if (loadGen !== loadGenRef.current || requestedEntityId !== entityIdRef.current) return
      setBundle(null)
      setError(err instanceof Error ? err.message : 'Failed to load bible')
    } finally {
      if (loadGen === loadGenRef.current && requestedEntityId === entityIdRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void load()
    return () => {
      loadGenRef.current += 1
    }
  }, [entityId, load])

  useEffect(() => {
    setAutofillUi(null)
  }, [entityId])

  useEffect(() => {
    if (autofillUi?.phase !== 'live') return
    if (stream.status !== 'done' && stream.status !== 'error') return
    void load()
    setAutofillUi({
      phase: 'summary',
      events: stream.events.map((e) => ({ ...e })),
      result: stream.result,
      streamError: stream.error,
      streamWarning: stream.warning,
      streamStatus: stream.status,
    })
  }, [autofillUi, stream.status, stream.events, stream.result, stream.error, stream.warning, load])

  const handleAutofillClick = useCallback(async () => {
    if (!entityId) return
    if (autofillUi?.phase === 'live') return
    setError('')
    try {
      const data = await startAutofillBible(entityId)
      const runId = data?.runId
      if (typeof runId !== 'string' || !runId) {
        throw new Error('Autofill did not return a run id')
      }
      setAutofillUi({ phase: 'live', runId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Autofill failed to start')
    }
  }, [entityId, autofillUi?.phase])

  const autofillBusy =
    autofillUi?.phase === 'live' && stream.status !== 'done' && stream.status !== 'error'

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
        <button
          type="button"
          className={styles.autofillBtn}
          disabled={autofillBusy}
          onClick={() => {
            void handleAutofillClick()
          }}
          data-testid="T_BIBLE_AUTOFILL"
        >
          Auto-fill gaps
        </button>
      </div>

      <AutofillStatusToast
        open={autofillUi != null}
        live={autofillUi?.phase === 'live'}
        events={autofillUi?.phase === 'live' ? stream.events : autofillUi?.events ?? []}
        result={autofillUi?.phase === 'live' ? stream.result : autofillUi?.result ?? null}
        streamStatus={autofillUi?.phase === 'live' ? stream.status : autofillUi?.streamStatus ?? 'idle'}
        streamError={autofillUi?.phase === 'live' ? stream.error : autofillUi?.streamError ?? ''}
        streamWarning={autofillUi?.phase === 'live' ? stream.warning : autofillUi?.streamWarning ?? ''}
        onDismiss={() => {
          setAutofillUi(null)
        }}
      />

      {loading ? <p className={styles.status}>Refreshing…</p> : null}

      <div className={styles.sectionGrid}>{panels}</div>

      <AttributeReviewPanel entityId={entityId} />
      <EntityConflictPanel entityId={entityId} />
    </div>
  )
}
