import { useEffect, useMemo, useRef, useState } from 'react'
import {
  approveBatchCandidate,
  archiveCharacter,
  generateBatch,
  getCharacterBatch,
  listBatchCandidates,
  listCharacterBatches,
  listCharacters,
  patchCharacterLifecycle,
  reconsiderBatchCandidate,
  rejectBatchCandidate,
  renameCharacter,
  restoreCharacter,
  saveBatchCandidate,
} from '../lib/api/characterBatches.js'
import { compilePromptPacksForCharacter, listPromptPacksForCharacter } from '../lib/api/promptPacks.js'
import {
  getComfyJobStatus,
  getComfyJobsStatus,
  getComfyStatus,
  ingestComfyOutputs,
  ingestComfyOutputsMany,
  listComfyWorkflows,
  queueComfyPromptPack,
  validateComfyWorkflow,
} from '../lib/api/comfy.js'
import { approveGeneratedImage, listGeneratedImages, rejectGeneratedImage } from '../lib/api/generatedImages.js'
import { queueCharacterPortfolio, queueMoreTakes } from '../lib/api/portfolio.js'
import { generateAudition } from '../lib/api/audition.js'
import { approveActorAudition, rejectActorAudition } from '../lib/api/actorAuditions.js'
import { listBankEntries } from '../lib/api/characterBank.js'
import styles from './CastingPipelinePanel.module.css'
import CharacterCard from './CastingRoom/CharacterCard.jsx'

const POLL_MS = 20000 // backup interval; SSE triggers immediate ticks
const ALL_VIEWS = ['front_portrait', 'three_quarter_portrait', 'profile_portrait', 'full_body', 'audition_still', 'cinematic_scene']

function StatusBadge({ status }) {
  if (!status || status === 'pending') return <span className={styles.subtle}>⟳ pending</span>
  if (status === 'running') return <span className={styles.subtle}>⟳ running…</span>
  if (status === 'success') return <span style={{ color: 'var(--color-success, green)' }}>✓ ready</span>
  if (status === 'failed') return <span className={styles.error}>✗ failed</span>
  return <span className={styles.subtle}>{status}</span>
}

function MoreTakesPanel({ characterId, moreTakesState, onQueue }) {
  const [selected, setSelected] = useState(new Set())
  const state = moreTakesState[characterId] || {}
  const { busy, error, jobs = [], jobStatuses = {} } = state
  const toggle = (v) => setSelected((prev) => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })
  const succeeded = jobs.filter((j) => jobStatuses[j.promptId] === 'success').length
  const failed = jobs.filter((j) => jobStatuses[j.promptId] === 'failed').length
  return (
    <div className={styles.moreTakes}>
      <div className={styles.subtle}><strong>More takes</strong> — queue additional views</div>
      <div className={styles.row} style={{ flexWrap: 'wrap', gap: 6 }}>
        {ALL_VIEWS.map((v) => (
          <label key={v} className={styles.viewChip} style={{ opacity: busy ? 0.5 : 1 }}>
            <input type="checkbox" checked={selected.has(v)} onChange={() => toggle(v)} disabled={busy} />
            {' '}{v.replace(/_/g, ' ')}
          </label>
        ))}
      </div>
      <div className={styles.row}>
        <button type="button" disabled={busy || selected.size === 0} onClick={() => onQueue(characterId, [...selected])}>
          {busy ? 'Queuing…' : 'Queue Takes'}
        </button>
        {jobs.length > 0 && (
          <span className={styles.subtle}>
            {succeeded}/{jobs.length} ready{failed > 0 ? ` · ${failed} failed` : ''}
          </span>
        )}
        {error && <span className={styles.error}>{error}</span>}
      </div>
    </div>
  )
}

function ErrorBanner({ message }) { return message ? <div className={styles.error}>{message}</div> : null }
function SuccessBanner({ message }) { return message ? <div className={styles.success}>{message}</div> : null }

function RenderStatusBar({ isPollingAudit, isPollingPortfolio, auditionStatuses, portfolioJobsStatus, moreTakesState, isSSEConnected }) {
  const auditTotal = Object.keys(auditionStatuses).length
  const auditDone = Object.values(auditionStatuses).filter((s) => s === 'success' || s === 'failed').length
  const portfolioItems = portfolioJobsStatus?.items || []
  const portfolioTotal = portfolioItems.length
  const portfolioDone = portfolioItems.filter((s) => s.status === 'success' || s.status === 'failed').length
  const mtTotal = Object.values(moreTakesState).reduce((sum, st) => sum + (st.jobs?.length || 0), 0)
  const mtDone = Object.values(moreTakesState).reduce((sum, st) =>
    sum + Object.values(st.jobStatuses || {}).filter((s) => s === 'success' || s === 'failed').length, 0)
  if (!isPollingAudit && !isPollingPortfolio && mtTotal === 0) return null
  const total = auditTotal + portfolioTotal + mtTotal
  const done = auditDone + portfolioDone + mtDone
  return (
    <div className={styles.statusBar}>
      <span className={`${styles.statusBarDot} ${done >= total ? styles.statusBarDotDone : ''}`} />
      <span>Rendering · {done}/{total} complete{isSSEConnected ? ' · live' : ' · polling'}</span>
      <div className={styles.statusBarSegments}>
        {auditTotal > 0 && <span className={styles.statusBarSegment}>⚡ Audition: {auditDone}/{auditTotal}</span>}
        {portfolioTotal > 0 && <span className={styles.statusBarSegment}>Portfolio: {portfolioDone}/{portfolioTotal}</span>}
        {mtTotal > 0 && <span className={styles.statusBarSegment}>More takes: {mtDone}/{mtTotal}</span>}
      </div>
    </div>
  )
}

export default function CastingPipelinePanel() {
  // ── Global UI state ───────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [candidateActionId, setCandidateActionId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [batchFeedback, setBatchFeedback] = useState(null) // { type: 'error'|'success', message }

  // ── Cast from Bank ────────────────────────────────────────────────────────
  const [bankEntries, setBankEntries] = useState([])
  const [selectedBankEntryId, setSelectedBankEntryId] = useState('')
  const [bankLoadError, setBankLoadError] = useState(null)
  const [auditionCount, setAuditionCount] = useState(3)
  const [auditionRunning, setAuditionRunning] = useState(false)
  const [auditionError, setAuditionError] = useState(null)
  const [auditionResults, setAuditionResults] = useState([])
  const [auditionRunMeta, setAuditionRunMeta] = useState(null)
  const [auditionStatuses, setAuditionStatuses] = useState({})
  const [auditionImages, setAuditionImages] = useState({})
  const [auditionItemActions, setAuditionItemActions] = useState({})
  const [moreTakesState, setMoreTakesState] = useState({})
  const [isPollingAudit, setIsPollingAudit] = useState(false)

  // ── Batch pipeline ────────────────────────────────────────────────────────
  const [batches, setBatches] = useState([])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [candidates, setCandidates] = useState([])

  // ── Active character ──────────────────────────────────────────────────────
  const [savedCharacters, setSavedCharacters] = useState([]) // [{id, name, age}]
  const [selectedCharacterId, setSelectedCharacterId] = useState('')
  const [promptPacks, setPromptPacks] = useState([])
  const [selectedPromptPackId, setSelectedPromptPackId] = useState('')

  // ── Workflow (shared) ─────────────────────────────────────────────────────
  const [workflows, setWorkflows] = useState([])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('')
  const [showInvalidWorkflows, setShowInvalidWorkflows] = useState(false)

  // ── Portfolio ─────────────────────────────────────────────────────────────
  const [portfolioViews, setPortfolioViews] = useState({
    front_portrait: true, three_quarter_portrait: true, profile_portrait: true,
    full_body: true, audition_still: true, cinematic_scene: false,
  })
  const [portfolioJobs, setPortfolioJobs] = useState([])
  const [portfolioJobsStatus, setPortfolioJobsStatus] = useState(null)
  const [isPollingPortfolio, setIsPollingPortfolio] = useState(false)

  // ── Gallery ───────────────────────────────────────────────────────────────
  const [generatedImages, setGeneratedImages] = useState([])
  const [imageLoadErrors, setImageLoadErrors] = useState({})

  // ── Batch generation form (hvz) ───────────────────────────────────────────
  const [batchFormOpen, setBatchFormOpen] = useState(false)
  const [batchGenAgeMin, setBatchGenAgeMin] = useState(25)
  const [batchGenAgeMax, setBatchGenAgeMax] = useState(45)
  const [batchGenCount, setBatchGenCount] = useState(10)
  const [batchGenTone, setBatchGenTone] = useState('')
  const [batchGenGender, setBatchGenGender] = useState('')
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [batchGenError, setBatchGenError] = useState(null)

  // ── Character management ──────────────────────────────────────────────────
  const [archivedCharacters, setArchivedCharacters] = useState([])
  const [renamingCharacterId, setRenamingCharacterId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [showDismissed, setShowDismissed] = useState(false)
  const activeCharSectionRef = useRef(null)
  const selectedCharacterIdRef = useRef('')
  const [compilingPrompts, setCompilingPrompts] = useState(new Set())
  const [postApprovalPrompt, setPostApprovalPrompt] = useState(null) // { characterId, characterName }

  // ── Dev tools ─────────────────────────────────────────────────────────────
  const [comfyStatus, setComfyStatus] = useState(null)
  const [workflowValidation, setWorkflowValidation] = useState(null)
  const [lastQueueResponse, setLastQueueResponse] = useState(null)
  const [jobStatus, setJobStatus] = useState(null)
  const [ingestResult, setIngestResult] = useState(null)

  // ── Polling refs ──────────────────────────────────────────────────────────
  const auditPollRef = useRef(null)
  const auditTickRef = useRef(null)
  const portfolioPollRef = useRef(null)
  const portfolioTickRef = useRef(null)
  const ingestedRef = useRef(new Set())

  // ── SSE real-time render updates ──────────────────────────────────────────
  const [isSSEConnected, setIsSSEConnected] = useState(false)
  const sseRef = useRef(null)
  const sseTickTimer = useRef(null)

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedBankEntry = useMemo(() => bankEntries.find((e) => e.id === selectedBankEntryId) || null, [bankEntries, selectedBankEntryId])
  const selectableWorkflows = useMemo(() => showInvalidWorkflows ? workflows : workflows.filter((w) => w.valid), [workflows, showInvalidWorkflows])
  const selectedPromptPack = useMemo(() => promptPacks.find((p) => p.id === selectedPromptPackId) || null, [promptPacks, selectedPromptPackId])
  const promptId = lastQueueResponse?.promptId || ''

  // ── Audit poll tick (updated every render → always reads latest state) ────
  auditTickRef.current = async () => {
    const jobs = []
    for (const result of auditionResults) {
      if (!result.ok || !Array.isArray(result.views)) continue
      for (const v of result.views) {
        if (v.ok && v.comfyPromptId &&
          auditionStatuses[v.comfyPromptId] !== 'success' &&
          auditionStatuses[v.comfyPromptId] !== 'failed') {
          jobs.push({ promptId: v.comfyPromptId, promptPackId: v.promptPackId, view: v.view, viewType: v.view, characterId: result.characterId, type: 'audition' })
        }
      }
    }
    for (const [charId, st] of Object.entries(moreTakesState)) {
      for (const job of (st.jobs || [])) {
        if (st.jobStatuses?.[job.promptId] !== 'success' && st.jobStatuses?.[job.promptId] !== 'failed') {
          jobs.push({ ...job, characterId: charId, type: 'moreTakes' })
        }
      }
    }
    if (jobs.length === 0) {
      clearInterval(auditPollRef.current); auditPollRef.current = null; setIsPollingAudit(false); return
    }
    try {
      const statusData = await getComfyJobsStatus(jobs)
      const statusMap = {}
      for (const item of (statusData?.items || [])) { if (item.promptId) statusMap[item.promptId] = item.status || 'unknown' }

      // Update audition statuses
      const auditUpdates = {}
      for (const j of jobs.filter((j) => j.type === 'audition')) {
        if (statusMap[j.promptId]) auditUpdates[j.promptId] = statusMap[j.promptId]
      }
      if (Object.keys(auditUpdates).length) setAuditionStatuses((prev) => ({ ...prev, ...auditUpdates }))

      // Update more-takes job statuses
      const mtUpdates = {}
      for (const j of jobs.filter((j) => j.type === 'moreTakes')) {
        if (statusMap[j.promptId]) {
          if (!mtUpdates[j.characterId]) mtUpdates[j.characterId] = {}
          mtUpdates[j.characterId][j.promptId] = statusMap[j.promptId]
        }
      }
      if (Object.keys(mtUpdates).length) {
        setMoreTakesState((prev) => {
          const next = { ...prev }
          for (const [charId, statuses] of Object.entries(mtUpdates)) {
            next[charId] = { ...next[charId], jobStatuses: { ...(next[charId]?.jobStatuses || {}), ...statuses } }
          }
          return next
        })
      }

      // Auto-ingest newly succeeded jobs
      const toIngest = jobs.filter((j) => statusMap[j.promptId] === 'success' && !ingestedRef.current.has(j.promptId))
      if (toIngest.length) {
        for (const j of toIngest) ingestedRef.current.add(j.promptId)
        try {
          await ingestComfyOutputsMany(toIngest.map((j) => ({ promptId: j.promptId, promptPackId: j.promptPackId, characterId: j.characterId, viewType: j.viewType || j.view })))
          const charIds = [...new Set(toIngest.map((j) => j.characterId))]
          const imageMap = {}
          for (const cId of charIds) {
            try { const list = await listGeneratedImages({ characterId: cId }); imageMap[cId] = list?.items || [] } catch { /* silent */ }
          }
          setAuditionImages((prev) => ({ ...prev, ...imageMap }))
        } catch { /* images will appear on next successful tick */ }
      }

      const allDone = jobs.every((j) => statusMap[j.promptId] === 'success' || statusMap[j.promptId] === 'failed')
      if (allDone) { clearInterval(auditPollRef.current); auditPollRef.current = null; setIsPollingAudit(false) }
    } catch { /* network error — keep polling */ }
  }

  function startAuditPoll() {
    if (auditPollRef.current) clearInterval(auditPollRef.current)
    auditPollRef.current = setInterval(() => auditTickRef.current?.(), POLL_MS)
    setIsPollingAudit(true)
  }

  // ── Portfolio poll tick ───────────────────────────────────────────────────
  portfolioTickRef.current = async () => {
    if (!portfolioJobs.length) { clearInterval(portfolioPollRef.current); portfolioPollRef.current = null; setIsPollingPortfolio(false); return }
    const pending = portfolioJobs.filter((j) => {
      const prev = portfolioJobsStatus?.items?.find((s) => s.promptId === j.promptId)
      return !prev || (prev.status !== 'success' && prev.status !== 'failed')
    })
    if (!pending.length) { clearInterval(portfolioPollRef.current); portfolioPollRef.current = null; setIsPollingPortfolio(false); return }
    try {
      const statusData = await getComfyJobsStatus(portfolioJobs)
      setPortfolioJobsStatus(statusData)
      const toIngest = (statusData?.items || []).filter((item) => item.ok && item.status === 'success' && !ingestedRef.current.has(item.promptId))
      if (toIngest.length) {
        const ingestJobs = toIngest.map((item) => portfolioJobs.find((j) => j.promptId === item.promptId)).filter(Boolean)
        for (const item of toIngest) ingestedRef.current.add(item.promptId)
        try { await ingestComfyOutputsMany(ingestJobs); await refreshGallery() } catch { /* silent */ }
      }
      const allDone = (statusData?.items || []).every((item) => item.status === 'success' || item.status === 'failed' || !item.ok)
      if (allDone) { clearInterval(portfolioPollRef.current); portfolioPollRef.current = null; setIsPollingPortfolio(false) }
    } catch { /* keep polling */ }
  }

  function startPortfolioPoll() {
    if (portfolioPollRef.current) clearInterval(portfolioPollRef.current)
    portfolioPollRef.current = setInterval(() => portfolioTickRef.current?.(), POLL_MS)
    setIsPollingPortfolio(true)
  }

  useEffect(() => () => { clearInterval(auditPollRef.current); clearInterval(portfolioPollRef.current) }, [])

  // ── SSE subscription — triggers immediate poll ticks when renders complete ─
  useEffect(() => {
    const active = isPollingAudit || isPollingPortfolio
    if (!active) {
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; setIsSSEConnected(false) }
      return
    }
    if (sseRef.current) return
    try {
      const source = new EventSource('/api/render-events')
      sseRef.current = source
      source.onopen = () => setIsSSEConnected(true)
      source.addEventListener('render-update', () => {
        if (sseTickTimer.current) return
        sseTickTimer.current = setTimeout(() => {
          sseTickTimer.current = null
          auditTickRef.current?.()
          portfolioTickRef.current?.()
        }, 250)
      })
      source.onerror = () => {
        source.close(); sseRef.current = null; setIsSSEConnected(false)
      }
    } catch { /* EventSource not supported — polling fallback is active */ }
    return () => {
      sseRef.current?.close(); sseRef.current = null; setIsSSEConnected(false)
      clearTimeout(sseTickTimer.current); sseTickTimer.current = null
    }
  }, [isPollingAudit, isPollingPortfolio]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restore polling state across tab navigation (72j) ────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('casting_room_audit_state')
      if (raw) {
        const { results, statuses } = JSON.parse(raw)
        if (Array.isArray(results) && results.length) {
          setAuditionResults(results)
          setAuditionStatuses(statuses || {})
          const hasPending = Object.values(statuses || {}).some((s) => s !== 'success' && s !== 'failed')
          if (hasPending) startAuditPoll()
        }
      }
    } catch { /* ignore corrupt storage */ }
    try {
      const raw = sessionStorage.getItem('casting_room_portfolio_state')
      if (raw) {
        const { jobs } = JSON.parse(raw)
        if (Array.isArray(jobs) && jobs.length) {
          setPortfolioJobs(jobs)
          startPortfolioPoll()
        }
      }
    } catch { /* ignore */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { selectedCharacterIdRef.current = selectedCharacterId }, [selectedCharacterId])

  // ── Data loading ──────────────────────────────────────────────────────────
  async function initialLoad() {
    setLoading(true); setError(''); setSuccess('')
    try {
      const [batchResult, workflowResult, comfyResult, charsResult, archivedResult] = await Promise.all([
        listCharacterBatches(), listComfyWorkflows(), getComfyStatus(),
        listCharacters().catch(() => ({ items: [] })),
        listCharacters({ includeArchived: 'only' }).catch(() => ({ items: [] })),
      ])
      setBatches(batchResult.items || [])
      setWorkflows(workflowResult.workflows || [])
      setComfyStatus(comfyResult.comfy || null)
      const chars = (charsResult.items || []).filter((c) => c?.id)
      setSavedCharacters((prev) => {
        const map = new Map(prev.map((c) => [c.id, c]))
        for (const c of chars) map.set(c.id, { id: c.id, name: c.name || '(unnamed)', age: c.age, lifecycleStatus: c.lifecycleStatus })
        return [...map.values()]
      })
      setArchivedCharacters((archivedResult.items || []).filter((c) => c?.id).map((c) => ({ id: c.id, name: c.name || '(unnamed)', age: c.age, lifecycleStatus: c.lifecycleStatus })))
      if (!selectedWorkflowId) {
        const def = (workflowResult.workflows || []).find((w) => w.valid)
        if (def) setSelectedWorkflowId(def.workflowId)
      }
    } catch (err) { setError(err.message || 'Failed to load casting room data.') }
    finally { setLoading(false) }
  }

  async function refreshBatch(batchId) {
    if (!batchId) return
    setActionLoading(true); setError('')
    try {
      const [batchRes, candidateRes] = await Promise.all([getCharacterBatch(batchId), listBatchCandidates(batchId)])
      setSelectedBatch(batchRes.item || null); setCandidates(candidateRes.items || [])
    } catch (err) { setError(err.message || 'Failed to refresh batch.') }
    finally { setActionLoading(false) }
  }

  async function refreshGallery() {
    try {
      const filters = selectedCharacterId ? { characterId: selectedCharacterId, limit: 100 }
        : selectedPromptPackId ? { promptPackId: selectedPromptPackId, limit: 100 } : { limit: 100 }
      const result = await listGeneratedImages(filters)
      setGeneratedImages(result.items || []); setImageLoadErrors({})
    } catch (err) { setError(err.message || 'Failed to load gallery.') }
  }

  useEffect(() => { initialLoad() }, [])
  useEffect(() => {
    let cancelled = false
    listBankEntries().then((data) => { if (!cancelled) { setBankEntries(data?.items || []); setBankLoadError(null) } })
      .catch((err) => { if (!cancelled) setBankLoadError(err?.message || 'Failed to load bank entries') })
    return () => { cancelled = true }
  }, [])
  useEffect(() => { refreshBatch(selectedBatchId) }, [selectedBatchId])
  useEffect(() => { if (selectedCharacterId || selectedPromptPackId) refreshGallery() }, [selectedCharacterId, selectedPromptPackId])

  // 7yi: Auto-load prompt packs whenever the active character changes.
  useEffect(() => {
    if (!selectedCharacterId) { setPromptPacks([]); setSelectedPromptPackId(''); return }
    listPromptPacksForCharacter(selectedCharacterId)
      .then((listed) => {
        setPromptPacks(listed.items || [])
        if (listed.items?.length) setSelectedPromptPackId(listed.items[0].id)
      })
      .catch(() => { /* non-critical; user can compile manually */ })
  }, [selectedCharacterId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cast from Bank handlers ───────────────────────────────────────────────
  const handleGenerateAudition = async () => {
    if (!selectedBankEntryId) { setAuditionError('Select a bank character first'); return }
    setAuditionRunning(true); setAuditionError(null)
    ingestedRef.current = new Set()
    try {
      sessionStorage.removeItem('casting_room_audit_state')
      const data = await generateAudition({
        bankEntryId: selectedBankEntryId,
        count: auditionCount,
        workflowId: selectedWorkflowId || undefined,
      })
      setAuditionResults(data?.results || [])
      setAuditionRunMeta({ requested: data?.requested, successful: data?.successful, failed: data?.failed })
      setAuditionImages({}); setAuditionItemActions({}); setMoreTakesState({})
      const initialStatuses = {}
      for (const r of (data?.results || [])) {
        if (!r.ok) continue
        for (const v of (r.views || [])) { if (v.ok && v.comfyPromptId) initialStatuses[v.comfyPromptId] = 'pending' }
      }
      setAuditionStatuses(initialStatuses)
      if (Object.keys(initialStatuses).length) startAuditPoll()
      try { sessionStorage.setItem('casting_room_audit_state', JSON.stringify({ results: data?.results || [], statuses: initialStatuses })) } catch { /* ignore */ }

      // 9p1: Refresh character list so Journey A characters appear in Active Character dropdown.
      // 9p1+ef3: Auto-select first successfully generated character if none already selected.
      const newSuccessCharIds = (data?.results || []).filter((r) => r.ok && r.characterId).map((r) => r.characterId)
      try {
        const charsResult = await listCharacters()
        const chars = (charsResult.items || []).filter((c) => c?.id)
        setSavedCharacters((prev) => {
          const map = new Map(prev.map((c) => [c.id, c]))
          for (const c of chars) map.set(c.id, { id: c.id, name: c.name || '(unnamed)', age: c.age, lifecycleStatus: c.lifecycleStatus })
          return [...map.values()]
        })
        if (!selectedCharacterId && newSuccessCharIds[0]) setSelectedCharacterId(newSuccessCharIds[0])
        for (const charId of newSuccessCharIds) backgroundCompilePromptPacks(charId)
      } catch { /* non-critical — characters appear after page refresh if this fails */ }
    } catch (err) { setAuditionError(err?.message || 'Audition generation failed') }
    finally { setAuditionRunning(false) }
  }

  const handleApproveAudition = async (auditionId) => {
    setAuditionItemActions((prev) => ({ ...prev, [auditionId]: { busy: true, error: null } }))
    try {
      await approveActorAudition(auditionId)
      setAuditionItemActions((prev) => ({ ...prev, [auditionId]: { busy: false, status: 'approved' } }))
      const matchedResult = auditionResults.find((r) => r.ok && r.views?.some((v) => v.auditionId === auditionId))
      const charId = matchedResult?.characterId
      if (charId) {
        setSelectedCharacterId(charId)
        const charName = savedCharacters.find((c) => c.id === charId)?.name || null
        setPostApprovalPrompt({ characterId: charId, characterName: charName })
      }
      setTimeout(() => activeCharSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    } catch (err) { setAuditionItemActions((prev) => ({ ...prev, [auditionId]: { busy: false, error: err?.message || 'Approve failed' } })) }
  }

  async function handleApproveAndQueuePortfolio(auditionId, characterId) {
    setAuditionItemActions((prev) => ({ ...prev, [auditionId]: { busy: true, error: null } }))
    try {
      await approveActorAudition(auditionId)
      setAuditionItemActions((prev) => ({ ...prev, [auditionId]: { busy: false, status: 'approved' } }))
    } catch (err) {
      setAuditionItemActions((prev) => ({ ...prev, [auditionId]: { busy: false, error: err?.message || 'Approve failed' } }))
      return
    }
    setSelectedCharacterId(characterId)
    setTimeout(() => activeCharSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    const views = selectedPortfolioViewList()
    if (!selectedWorkflowId || !views.length) {
      const charName = savedCharacters.find((c) => c.id === characterId)?.name || null
      setPostApprovalPrompt({ characterId, characterName: charName })
      return
    }
    try {
      const result = await queueCharacterPortfolio({
        characterId, views, workflowId: selectedWorkflowId,
        options: { persistPromptPacks: true, aspectRatio: '2:3', styleProfile: 'cinematic casting portrait' },
      })
      const jobs = (result.queued || []).filter((item) => item.ok && item.result?.promptId).map((item) => ({
        promptId: item.result.promptId, promptPackId: item.promptPackId,
        view: item.view, characterId, workflowVersion: selectedWorkflowId, viewType: item.view,
      }))
      setPortfolioJobs(jobs); setPortfolioJobsStatus(null)
      for (const j of jobs) ingestedRef.current.delete(j.promptId)
      try { sessionStorage.setItem('casting_room_portfolio_state', JSON.stringify({ jobs })) } catch { /* ignore */ }
      if (jobs.length) startPortfolioPoll()
      setSuccess(`Approved & queued ${result.summary?.success || 0} portfolio view(s).`)
    } catch (err) { setError(err?.message || 'Portfolio queue failed') }
  }

  const handleRejectAudition = async (auditionId) => {
    const reason = window.prompt('Reason for rejection (optional)') || undefined
    setAuditionItemActions((prev) => ({ ...prev, [auditionId]: { busy: true, error: null } }))
    try {
      await rejectActorAudition(auditionId, reason)
      setAuditionItemActions((prev) => ({ ...prev, [auditionId]: { busy: false, status: 'rejected' } }))
    } catch (err) { setAuditionItemActions((prev) => ({ ...prev, [auditionId]: { busy: false, error: err?.message || 'Reject failed' } })) }
  }

  const handleMoreTakes = async (characterId, selectedViews) => {
    if (!characterId || !selectedViews?.length) return
    setMoreTakesState((prev) => ({ ...prev, [characterId]: { busy: true, error: null, jobs: [], jobStatuses: {} } }))
    try {
      const result = await queueMoreTakes({ characterId, views: selectedViews })
      const jobs = (result.queued || [])
        .filter((item) => item.ok && item.result?.promptId)
        .map((item) => ({
          promptId: item.result.promptId, promptPackId: item.promptPackId,
          view: item.view, viewType: item.view, characterId,
          workflowVersion: item.result.workflowId || item.result.resolvedWorkflowId || '',
        }))
      setMoreTakesState((prev) => ({ ...prev, [characterId]: { busy: false, error: null, jobs, jobStatuses: {} } }))
      if (jobs.length) startAuditPoll()
    } catch (err) {
      setMoreTakesState((prev) => ({ ...prev, [characterId]: { busy: false, error: err?.message || 'Queue failed', jobs: [], jobStatuses: {} } }))
    }
  }

  // ── Batch pipeline handlers ───────────────────────────────────────────────
  async function handleCandidateAction(action, candidateId) {
    setCandidateActionId(candidateId); setError(''); setSuccess(''); setBatchFeedback(null)
    try {
      if (action === 'approve') await approveBatchCandidate(candidateId)
      if (action === 'reject') await rejectBatchCandidate(candidateId, 'Rejected manually')
      if (action === 'reconsider') await reconsiderBatchCandidate(candidateId)
      if (action === 'save') {
        const saved = await saveBatchCandidate(candidateId)
        const newId = saved?.item?.savedCharacterId
        if (newId) {
          const cand = saved?.item?.candidate
          setSavedCharacters((prev) => {
            const map = new Map(prev.map((c) => [c.id, c]))
            map.set(newId, { id: newId, name: cand?.name || '(unnamed)', age: cand?.age, lifecycleStatus: 'auditioned' })
            return [...map.values()]
          })
          setSelectedCharacterId(newId)
          const charName = cand?.name || null
          setBatchFeedback({ type: 'success', message: `Character saved${charName ? `: ${charName}` : ''}.` })
          backgroundCompilePromptPacks(newId)
          setPostApprovalPrompt({ characterId: newId, characterName: charName })
          setTimeout(() => activeCharSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
        } else {
          setBatchFeedback({ type: 'error', message: 'Save completed but no character ID returned — check server logs.' })
        }
      }
      await refreshBatch(selectedBatchId)
      if (action !== 'save') setBatchFeedback({ type: 'success', message: action === 'reconsider' ? 'Candidate returned to pending review.' : `Candidate ${action}d.` })
    } catch (err) {
      const msg = err.message || `Failed to ${action} candidate.`
      setError(msg)
      setBatchFeedback({ type: 'error', message: msg })
    }
    finally { setCandidateActionId(null) }
  }

  // ── Active character handlers ─────────────────────────────────────────────
  async function handleCompileAndListPromptPacks() {
    if (!selectedCharacterId) return
    setActionLoading(true); setError(''); setSuccess('')
    try {
      await compilePromptPacksForCharacter(selectedCharacterId, selectedWorkflowId)
      const listed = await listPromptPacksForCharacter(selectedCharacterId)
      setPromptPacks(listed.items || [])
      if (listed.items?.length) setSelectedPromptPackId(listed.items[0].id)
      setSuccess(`Compiled ${listed.items?.length || 0} prompt pack(s).`)
    } catch (err) { setError(err.message || 'Failed to compile prompt packs.') }
    finally { setActionLoading(false) }
  }

  async function backgroundCompilePromptPacks(characterId) {
    setCompilingPrompts((prev) => { const n = new Set(prev); n.add(characterId); return n })
    try {
      await compilePromptPacksForCharacter(characterId, selectedWorkflowId)
      const listed = await listPromptPacksForCharacter(characterId)
      if (selectedCharacterIdRef.current === characterId) {
        setPromptPacks(listed.items || [])
        if (listed.items?.length) setSelectedPromptPackId(listed.items[0].id)
      }
    } catch { /* silent — user can compile manually */ }
    finally { setCompilingPrompts((prev) => { const n = new Set(prev); n.delete(characterId); return n }) }
  }

  async function handleLoadPromptPacks() {
    if (!selectedCharacterId) return
    setActionLoading(true); setError('')
    try {
      const listed = await listPromptPacksForCharacter(selectedCharacterId)
      setPromptPacks(listed.items || [])
      if (listed.items?.length && !selectedPromptPackId) setSelectedPromptPackId(listed.items[0].id)
    } catch (err) { setError(err.message || 'Failed to list prompt packs.') }
    finally { setActionLoading(false) }
  }

  // ── Portfolio handlers ────────────────────────────────────────────────────
  const selectedPortfolioViewList = () => Object.entries(portfolioViews).filter(([, on]) => on).map(([v]) => v)

  async function handleQueuePortfolio() {
    const views = selectedPortfolioViewList()
    if (!selectedCharacterId || !selectedWorkflowId || !views.length) return
    setActionLoading(true); setError(''); setSuccess('')
    try {
      const result = await queueCharacterPortfolio({
        characterId: selectedCharacterId, views, workflowId: selectedWorkflowId,
        options: { persistPromptPacks: true, aspectRatio: '2:3', styleProfile: 'cinematic casting portrait' },
      })
      const jobs = (result.queued || []).filter((item) => item.ok && item.result?.promptId).map((item) => ({
        promptId: item.result.promptId, promptPackId: item.promptPackId,
        view: item.view, characterId: selectedCharacterId,
        workflowVersion: selectedWorkflowId, viewType: item.view,
      }))
      setPortfolioJobs(jobs); setPortfolioJobsStatus(null)
      for (const j of jobs) ingestedRef.current.delete(j.promptId)
      try { sessionStorage.setItem('casting_room_portfolio_state', JSON.stringify({ jobs })) } catch { /* ignore */ }
      setSuccess(`Portfolio queued: ${result.summary?.success || 0} views.`)
      if (jobs.length) startPortfolioPoll()
      patchCharacterLifecycle(selectedCharacterId, 'portfolio_pending').catch(() => { /* non-critical */ })
    } catch (err) { setError(err.message || 'Failed to queue portfolio.') }
    finally { setActionLoading(false) }
  }

  // ── Gallery handler ───────────────────────────────────────────────────────
  async function handleGeneratedImageReview(action, id) {
    setActionLoading(true); setError(''); setSuccess('')
    try {
      if (action === 'approve') await approveGeneratedImage(id)
      if (action === 'reject') await rejectGeneratedImage(id, 'Rejected manually')
      await refreshGallery(); setSuccess(`Image ${action}d.`)
      if (action === 'approve' && selectedCharacterId) {
        patchCharacterLifecycle(selectedCharacterId, 'ready').catch(() => { /* non-critical */ })
        setSavedCharacters((prev) => prev.map((c) => c.id === selectedCharacterId ? { ...c, lifecycleStatus: 'ready' } : c))
      }
    } catch (err) { setError(err.message || `Failed to ${action} image.`) }
    finally { setActionLoading(false) }
  }

  // ── Character management handlers ─────────────────────────────────────────
  async function handleArchive(charId) {
    try {
      await archiveCharacter(charId)
      const char = savedCharacters.find((c) => c.id === charId)
      setSavedCharacters((prev) => prev.filter((c) => c.id !== charId))
      if (char) setArchivedCharacters((prev) => prev.some((c) => c.id === char.id) ? prev : [...prev, char])
      if (selectedCharacterId === charId) setSelectedCharacterId('')
    } catch (err) { setError(err?.message || 'Archive failed') }
  }

  async function handleRestore(charId) {
    try {
      await restoreCharacter(charId)
      const char = archivedCharacters.find((c) => c.id === charId)
      setArchivedCharacters((prev) => prev.filter((c) => c.id !== charId))
      if (char) setSavedCharacters((prev) => prev.some((c) => c.id === char.id) ? prev : [...prev, char])
    } catch (err) { setError(err?.message || 'Restore failed') }
  }

  async function handleRenameCharacter() {
    if (!renamingCharacterId || !renameValue.trim()) return
    setActionLoading(true); setError(''); setSuccess('')
    try {
      await renameCharacter(renamingCharacterId, renameValue.trim())
      setSavedCharacters((prev) => prev.map((c) => c.id === renamingCharacterId ? { ...c, name: renameValue.trim() } : c))
      setRenamingCharacterId(null)
      setSuccess(`Renamed to "${renameValue.trim()}"`)
    } catch (err) { setError(err?.message || 'Rename failed') }
    finally { setActionLoading(false) }
  }

  // ── Batch generation handler (hvz) ───────────────────────────────────────
  async function handleGenerateBatch() {
    setBatchGenerating(true); setBatchGenError(null); setError(''); setSuccess('')
    try {
      await generateBatch({
        request: {
          count: batchGenCount,
          ageMin: batchGenAgeMin,
          ageMax: batchGenAgeMax,
          ...(batchGenGender ? { genderPresentation: batchGenGender } : {}),
          ...(batchGenTone ? { projectTone: batchGenTone } : {}),
          outputViews: ['front_portrait', 'profile_portrait'],
          diversityRequirements: [],
        },
        options: { persistBatch: true, checkSimilarity: true },
      })
      setBatchFormOpen(false)
      const batchResult = await listCharacterBatches()
      setBatches(batchResult.items || [])
      if (batchResult.items?.[0]?.id) setSelectedBatchId(batchResult.items[0].id)
      setSuccess('Batch generated — reviewing candidates below.')
    } catch (err) { setBatchGenError(err?.message || 'Batch generation failed') }
    finally { setBatchGenerating(false) }
  }

  // ── Dev-tools handlers ────────────────────────────────────────────────────
  async function handleValidateWorkflow() {
    if (!selectedWorkflowId) return
    setActionLoading(true); setError('')
    try {
      const result = await validateComfyWorkflow(selectedWorkflowId)
      setWorkflowValidation(result)
      if (result.ok) setSuccess('Workflow validation passed.')
    } catch (err) { setError(err.message || 'Validation failed.') }
    finally { setActionLoading(false) }
  }

  async function handleQueue(dryRun) {
    if (!selectedPromptPackId || !selectedWorkflowId) return
    setActionLoading(true); setError(''); setSuccess('')
    try {
      const result = await queueComfyPromptPack({ promptPackId: selectedPromptPackId, workflowId: selectedWorkflowId, dryRun })
      setLastQueueResponse(result)
      setSuccess(dryRun ? 'Dry-run complete.' : `Queued. Prompt ID: ${result.promptId || '(none)'}`)
    } catch (err) { setError(err.message || 'Queue failed.') }
    finally { setActionLoading(false) }
  }

  async function handleJobStatus() {
    if (!promptId) return
    setActionLoading(true); setError('')
    try { setJobStatus(await getComfyJobStatus(promptId)) }
    catch (err) { setError(err.message || 'Status check failed.') }
    finally { setActionLoading(false) }
  }

  async function handleIngest() {
    if (!promptId || !selectedPromptPackId) return
    setActionLoading(true); setError('')
    try {
      const result = await ingestComfyOutputs({
        promptId, promptPackId: selectedPromptPackId, workflowVersion: selectedWorkflowId,
        characterId: selectedCharacterId || selectedPromptPack?.characterId, viewType: 'front_portrait',
      })
      setIngestResult(result); setSuccess(`Ingested ${result.created || 0} image(s).`); await refreshGallery()
    } catch (err) { setError(err.message || 'Ingest failed.') }
    finally { setActionLoading(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Casting Room</h2>
      {loading && <div className={styles.subtle}>Loading…</div>}
      <RenderStatusBar
        isPollingAudit={isPollingAudit}
        isPollingPortfolio={isPollingPortfolio}
        auditionStatuses={auditionStatuses}
        portfolioJobsStatus={portfolioJobsStatus}
        moreTakesState={moreTakesState}
        isSSEConnected={isSSEConnected}
      />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {/* ─── 1. CAST FROM BANK ─────────────────────────────────────────── */}
      <section className={styles.section}>
        <h3>Cast from Bank</h3>
        {bankLoadError ? (
          <div className={styles.subtle}>Bank unavailable: {bankLoadError}</div>
        ) : bankEntries.length === 0 ? (
          <div className={styles.subtle}>No casting briefs yet. Add one in the Character Builder tab.</div>
        ) : (
          <>
            <div className={styles.row}>
              <select value={selectedBankEntryId} onChange={(e) => setSelectedBankEntryId(e.target.value)} className={styles.select}>
                <option value="">Select a character…</option>
                {bankEntries.map((entry) => <option key={entry.id} value={entry.id}>@{entry.slug} — {entry.name}</option>)}
              </select>
            </div>
            {selectedBankEntry && (
              <div className={styles.subtle}>
                <strong>{selectedBankEntry.name}</strong> — {selectedBankEntry.optimizedDescription || selectedBankEntry.description}
              </div>
            )}
            <div className={styles.row}>
              <select value={selectedWorkflowId} onChange={(e) => setSelectedWorkflowId(e.target.value)} className={styles.select} disabled={auditionRunning}>
                <option value="">Default workflow</option>
                {selectableWorkflows.map((w) => <option key={w.workflowId} value={w.workflowId}>{w.workflowId}</option>)}
              </select>
            </div>
            <div className={styles.row}>
              <label>Count</label>
              <input type="number" min={1} max={10} value={auditionCount} style={{ width: 60 }}
                onChange={(e) => setAuditionCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                disabled={auditionRunning} />
              <button type="button" onClick={handleGenerateAudition} disabled={auditionRunning || !selectedBankEntryId}>
                {auditionRunning ? 'Generating…' : 'Generate Auditions'}
              </button>
              {isPollingAudit && <span className={styles.subtle}>⟳ checking Comfy…</span>}
              {auditionError && <span className={styles.error}>{auditionError}</span>}
            </div>

            {auditionResults.length > 0 && (
              <div className={styles.section}>
                <div className={styles.subtle}>
                  {auditionRunMeta?.successful ?? 0} generated · {auditionRunMeta?.failed ?? 0} failed
                  {isPollingAudit ? ' — images appear automatically when ready' : ''}
                </div>
                {Object.keys(auditionStatuses).length > 0 && (
                  <div className={styles.subtle}>
                    Front portrait and profile portrait are queued for each candidate above.
                    To generate other views (full body, cinematic scene, etc.) use Portfolio below — uncheck front and profile to avoid duplicates.
                  </div>
                )}
                {auditionResults.map((result, index) => (
                  <div key={result.pairId || `failed-${index}`} className={styles.item}>
                    {result.ok ? (
                      <>
                        <CharacterCard
                          character={result.character}
                          lifecycleStatus={savedCharacters.find((c) => c.id === result.characterId)?.lifecycleStatus}
                        />
                        <div className={styles.subtle} style={{ marginTop: 4 }}>
                          Pair {result.pairId?.slice(0, 8)} · char {result.characterId?.slice(0, 8)}
                        </div>
                        <div className={styles.row} style={{ alignItems: 'flex-start', gap: 16 }}>
                          {(result.views || []).map((v) => (
                            <div key={v.view} style={{ flex: 1, minWidth: 120 }}>
                              <div className={styles.subtle} style={{ marginBottom: 4 }}>
                                {v.view.replace(/_/g, ' ')} <StatusBadge status={v.comfyPromptId ? auditionStatuses[v.comfyPromptId] : null} />
                              </div>
                              {v.ok ? (
                                <>
                                  {(auditionImages[result.characterId] || [])
                                    .filter((img) => !img.viewType || img.viewType === v.view)
                                    .slice(0, 2)
                                    .map((img) => (
                                      <img key={img.id}
                                        src={`/api/generated-image-view?id=${encodeURIComponent(img.id)}`}
                                        alt={v.view}
                                        style={{ maxWidth: 110, maxHeight: 150, objectFit: 'cover', marginRight: 4, display: 'block', marginBottom: 4 }}
                                      />
                                    ))}
                                  <div className={styles.row}>
                                    <button type="button" onClick={() => handleApproveAudition(v.auditionId)}
                                      disabled={auditionItemActions[v.auditionId]?.busy}>
                                      {auditionItemActions[v.auditionId]?.status === 'approved' ? '✓ Selected' : 'Select this look'}
                                    </button>
                                    <button type="button"
                                      className={styles.approvePortfolioBtn}
                                      onClick={() => handleApproveAndQueuePortfolio(v.auditionId, result.characterId)}
                                      disabled={auditionItemActions[v.auditionId]?.busy || auditionItemActions[v.auditionId]?.status === 'approved'}>
                                      Approve + Portfolio
                                    </button>
                                    <button type="button" onClick={() => handleRejectAudition(v.auditionId)}
                                      disabled={auditionItemActions[v.auditionId]?.busy}>
                                      {auditionItemActions[v.auditionId]?.status === 'rejected' ? '✗ Passed' : 'Pass'}
                                    </button>
                                    {auditionItemActions[v.auditionId]?.error && (
                                      <span className={styles.error}>{auditionItemActions[v.auditionId].error}</span>
                                    )}
                                  </div>
                                </>
                              ) : <span className={styles.error}>{v.error}</span>}
                            </div>
                          ))}
                        </div>
                        {result.ok && !auditionRunning && (
                          <MoreTakesPanel characterId={result.characterId} moreTakesState={moreTakesState} onQueue={handleMoreTakes} />
                        )}
                      </>
                    ) : <span className={styles.error}>Failed: {result.error} ({result.code})</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ─── 2. BATCH PIPELINE ─────────────────────────────────────────── */}
      <section className={styles.section}>
        <h3>Batch Pipeline</h3>
        <div className={styles.row}>
          <button type="button" onClick={() => setBatchFormOpen((o) => !o)}>
            {batchFormOpen ? '▾ Cancel' : '+ Generate Batch'}
          </button>
        </div>
        {batchFormOpen && (
          <div className={styles.item}>
            <div className={styles.row}>
              <label>Age</label>
              <input type="number" min={16} max={100} value={batchGenAgeMin} style={{ width: 55 }}
                onChange={(e) => setBatchGenAgeMin(Math.max(16, Math.min(100, Number(e.target.value) || 16)))} />
              <span className={styles.subtle}>–</span>
              <input type="number" min={16} max={100} value={batchGenAgeMax} style={{ width: 55 }}
                onChange={(e) => setBatchGenAgeMax(Math.max(16, Math.min(100, Number(e.target.value) || 100)))} />
              <label>Count</label>
              <input type="number" min={1} max={50} value={batchGenCount} style={{ width: 55 }}
                onChange={(e) => setBatchGenCount(Math.max(1, Math.min(50, Number(e.target.value) || 5)))} />
            </div>
            <div className={styles.row}>
              <label>Gender</label>
              <select value={batchGenGender} onChange={(e) => setBatchGenGender(e.target.value)} className={styles.select}>
                <option value="">Mixed (any)</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="nonbinary">Non-binary</option>
              </select>
            </div>
            <div className={styles.row}>
              <label>Tone</label>
              <input type="text" value={batchGenTone} placeholder="e.g. gritty noir, editorial, raw"
                onChange={(e) => setBatchGenTone(e.target.value)} style={{ flex: 1 }} />
            </div>
            <div className={styles.subtle} style={{ marginBottom: 4 }}>
              Tone biases character aesthetics — cinematic favors screen presence, editorial favors distinctive unconventional looks, raw favors naturalistic imperfect features.
            </div>
            <div className={styles.row}>
              <button type="button" onClick={handleGenerateBatch} disabled={batchGenerating}>
                {batchGenerating ? 'Generating…' : 'Generate'}
              </button>
              {batchGenError && <span className={styles.error}>{batchGenError}</span>}
            </div>
          </div>
        )}
        {batches.length === 0 ? (
          <div className={styles.subtle}>No batches yet — generate one above.</div>
        ) : (
          <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} className={styles.select}>
            <option value="">Select a batch…</option>
            {batches.map((batch) => {
              const date = batch.createdAt ? new Date(batch.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : batch.id.slice(0, 8)
              const count = batch.request?.count ?? '?'
              const tone = batch.request?.projectTone ? ` · ${batch.request.projectTone}` : ''
              return <option key={batch.id} value={batch.id}>{date} — {count} chars{tone} ({batch.status})</option>
            })}
          </select>
        )}
        {selectedBatch && (
          <div className={styles.subtle}>
            {selectedBatch.summary?.totalCandidates ?? 0} candidate{(selectedBatch.summary?.totalCandidates ?? 0) !== 1 ? 's' : ''} · status: {selectedBatch.status}
            {selectedBatch.summary?.byReviewStatus?.pending > 0 && ` · ${selectedBatch.summary.byReviewStatus.pending} pending review`}
          </div>
        )}
        {batchFeedback && (
          <div className={batchFeedback.type === 'error' ? styles.error : styles.success} style={{ marginTop: 8 }}>
            {batchFeedback.message}
          </div>
        )}
        {selectedBatchId && candidates.length === 0 && <div className={styles.subtle}>No candidates in this batch.</div>}
        {candidates.length > 0 && (() => {
          const dismissedCount = candidates.filter((c) => c.reviewStatus === 'rejected').length
          const allDismissed = dismissedCount === candidates.length
          const displayed = candidates.filter((c) => allDismissed || showDismissed || c.reviewStatus !== 'rejected')
          const classLabel = { accepted: 'unique', needsMutation: 'needs change', rejected: 'too similar' }
          return (
            <>
              {allDismissed && (
                <div className={styles.subtle}>
                  All {dismissedCount} candidate{dismissedCount !== 1 ? 's' : ''} were auto-dismissed (too similar to existing characters or failed LLM validation). Click Reconsider on any to review them.
                </div>
              )}
              {!allDismissed && dismissedCount > 0 && (
                <div className={styles.row}>
                  <button type="button" onClick={() => setShowDismissed((v) => !v)}>
                    {showDismissed ? 'Hide dismissed' : `Show dismissed (${dismissedCount})`}
                  </button>
                </div>
              )}
              <div className={styles.list}>
                {displayed.map((candidate) => {
                  const isBusy = candidateActionId === candidate.id
                  const batchActions = []
                  let approvalHint
                  if (candidate.reviewStatus === 'pending') {
                    batchActions.push({ label: isBusy ? 'Casting…' : 'Cast this character', onClick: () => handleCandidateAction('approve', candidate.id), disabled: isBusy, variant: 'primary' })
                    batchActions.push({ label: 'Dismiss', onClick: () => handleCandidateAction('reject', candidate.id), disabled: isBusy, variant: 'danger' })
                  } else if (candidate.reviewStatus === 'approved') {
                    batchActions.push({ label: isBusy ? 'Saving…' : 'Save → Active Character', onClick: () => handleCandidateAction('save', candidate.id), disabled: isBusy, variant: 'primary' })
                    batchActions.push({ label: 'Dismiss', onClick: () => handleCandidateAction('reject', candidate.id), disabled: isBusy, variant: 'danger' })
                    approvalHint = 'Ready to add to your cast — click Save to confirm.'
                  } else if (candidate.reviewStatus === 'rejected') {
                    batchActions.push({ label: 'Reconsider', onClick: () => handleCandidateAction('reconsider', candidate.id), disabled: isBusy })
                  }
                  const isSaved = candidate.reviewStatus === 'saved'
                  const clLabel = isSaved
                    ? 'Saved ✓'
                    : `${candidate.reviewStatus} · ${classLabel[candidate.classification] || candidate.classification}${candidate.reviewNote ? ` · ${candidate.reviewNote}` : ''}`
                  return (
                    <CharacterCard
                      key={candidate.id}
                      character={candidate.candidate}
                      dimmed={candidate.reviewStatus === 'rejected'}
                      classificationLabel={clLabel}
                      classificationLabelVariant={isSaved ? 'saved' : undefined}
                      actions={batchActions}
                      actionHint={approvalHint}
                    />
                  )
                })}
              </div>
            </>
          )
        })()}
      </section>

      {/* ─── 3. ACTIVE CHARACTER ───────────────────────────────────────── */}
      <section className={styles.section} ref={activeCharSectionRef}>
        <h3>Active Character</h3>
        <div className={styles.row}>
          <select value={selectedCharacterId} onChange={(e) => { setSelectedCharacterId(e.target.value); setRenamingCharacterId(null) }} className={styles.select}>
            <option value="">Select character…</option>
            {savedCharacters.map((c) => {
              const lcLabel = c.lifecycleStatus === 'portfolio_pending' ? ' ⏳' : c.lifecycleStatus === 'ready' ? ' ✓' : ''
              return <option key={c.id} value={c.id}>{c.name}{c.age ? `, ${c.age}` : ''}{lcLabel} ({c.id.slice(0, 8)}…)</option>
            })}
          </select>
          <button disabled={actionLoading || !selectedCharacterId} onClick={handleCompileAndListPromptPacks}>
            {compilingPrompts.has(selectedCharacterId) ? 'Compiling…' : promptPacks.length > 0 ? 'Recompile Packs' : 'Compile Prompt Packs'}
          </button>
        </div>

        {selectedCharacterId && (
          <div className={styles.row}>
            {renamingCharacterId === selectedCharacterId ? (
              <>
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCharacter(); if (e.key === 'Escape') setRenamingCharacterId(null) }}
                  style={{ flex: 1 }}
                  autoFocus
                />
                <button disabled={actionLoading || !renameValue.trim()} onClick={handleRenameCharacter}>Save name</button>
                <button onClick={() => setRenamingCharacterId(null)}>Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => { setRenamingCharacterId(selectedCharacterId); setRenameValue(savedCharacters.find((c) => c.id === selectedCharacterId)?.name || '') }}>
                  Rename
                </button>
                <button onClick={() => handleArchive(selectedCharacterId)}>Archive</button>
              </>
            )}
          </div>
        )}

        {archivedCharacters.length > 0 && (
          <details style={{ marginTop: 6 }}>
            <summary className={styles.subtle} style={{ cursor: 'pointer', userSelect: 'none' }}>
              ▸ Archived characters ({archivedCharacters.length})
            </summary>
            <div style={{ marginTop: 6 }}>
              {archivedCharacters.map((c) => (
                <div key={c.id} className={styles.row}>
                  <span className={styles.subtle}>{c.name}{c.age ? `, ${c.age}` : ''}</span>
                  <button onClick={() => handleRestore(c.id)}>Restore</button>
                </div>
              ))}
            </div>
          </details>
        )}

        {postApprovalPrompt && (
          <div className={styles.portfolioToast}>
            <span>Character ready{postApprovalPrompt.characterName ? `: ${postApprovalPrompt.characterName}` : ''}.</span>
            <button
              className={styles.portfolioToastBtn}
              disabled={!selectedWorkflowId || actionLoading}
              onClick={() => { handleQueuePortfolio(); setPostApprovalPrompt(null) }}
            >
              Generate Full Portfolio
            </button>
            <button
              onClick={() => setPostApprovalPrompt(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 14 }}
            >✕</button>
          </div>
        )}

        {promptPacks.length > 0 && (
          <select value={selectedPromptPackId} onChange={(e) => setSelectedPromptPackId(e.target.value)} className={styles.select}>
            <option value="">Select prompt pack…</option>
            {promptPacks.map((pack) => (
              <option key={pack.id} value={pack.id}>{pack.id.slice(0, 16)}… {pack.camera ? `· ${pack.camera}` : ''}</option>
            ))}
          </select>
        )}
      </section>

      {/* ─── 4. PORTFOLIO ──────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h3>Portfolio</h3>
        {selectedCharacterId && (
          <div className={styles.subtle}>
            {generatedImages.filter((img) => img.characterId === selectedCharacterId).length > 0
              ? 'This character has audition images — queue Portfolio to add more views.'
              : 'No images yet — queue Portfolio to generate this character\'s first set.'}
          </div>
        )}
        <div className={styles.row}>
          <select value={selectedWorkflowId} onChange={(e) => setSelectedWorkflowId(e.target.value)} className={styles.select}>
            <option value="">Select workflow…</option>
            {selectableWorkflows.map((w) => <option key={w.workflowId} value={w.workflowId}>{w.workflowId}{w.valid ? '' : ' (invalid)'}</option>)}
          </select>
          <label className={styles.subtle}>
            <input type="checkbox" checked={showInvalidWorkflows} onChange={(e) => setShowInvalidWorkflows(e.target.checked)} />
            {' '}show invalid
          </label>
        </div>
        <div className={styles.row} style={{ flexWrap: 'wrap', gap: 6 }}>
          {Object.keys(portfolioViews).map((view) => (
            <label key={view} className={styles.subtle}>
              <input type="checkbox" checked={portfolioViews[view]}
                onChange={(e) => setPortfolioViews((prev) => ({ ...prev, [view]: e.target.checked }))} />
              {' '}{view.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
        <div className={styles.row}>
          <button
            disabled={!selectedCharacterId || !selectedWorkflowId || !selectedPortfolioViewList().length || actionLoading}
            onClick={handleQueuePortfolio}
          >
            Queue Portfolio
          </button>
          {isPollingPortfolio && <span className={styles.subtle}>⟳ checking Comfy…</span>}
        </div>
        {portfolioJobs.length > 0 && (
          <div className={styles.list}>
            {portfolioJobs.map((job) => {
              const status = portfolioJobsStatus?.items?.find((x) => x.promptId === job.promptId)
              return (
                <div className={styles.item} key={job.promptId}>
                  <span className={styles.itemTitle}>{job.view.replace(/_/g, ' ')}</span>
                  {' '}<StatusBadge status={status?.status || (status?.ok === false ? 'failed' : 'pending')} />
                  {status?.error && <span className={styles.error}> {status.error}</span>}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ─── 5. GALLERY ────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h3>Gallery</h3>
        <div className={styles.row}>
          <button disabled={actionLoading || (!selectedCharacterId && !selectedPromptPackId)} onClick={refreshGallery}>
            Refresh
          </button>
          <span className={styles.subtle}>
            {selectedCharacterId
              ? `Showing images for: ${savedCharacters.find((c) => c.id === selectedCharacterId)?.name || selectedCharacterId.slice(0, 8)}`
              : selectedPromptPackId ? `Showing images for pack ${selectedPromptPackId.slice(0, 8)}…`
              : 'select a character above'}
          </span>
        </div>
        {generatedImages.length === 0 ? (
          <div className={styles.subtle}>No generated images for current filter.</div>
        ) : (
          <div className={styles.galleryGrid}>
            {generatedImages.map((item) => (
              <div className={styles.item} key={item.id}>
                <div className={styles.subtle}>{item.viewType} · seed {Number.isInteger(item.seed) ? item.seed : '—'} · {item.approved ? '✓' : 'pending'}</div>
                <img className={styles.preview}
                  src={`/api/generated-image-view?id=${encodeURIComponent(item.id)}`}
                  alt={item.viewType || item.id}
                  onError={() => setImageLoadErrors((prev) => ({ ...prev, [item.id]: true }))}
                />
                {imageLoadErrors[item.id] && <div className={styles.error}>Preview unavailable</div>}
                <div className={styles.row}>
                  <button disabled={actionLoading} onClick={() => handleGeneratedImageReview('approve', item.id)}>Keep</button>
                  <button disabled={actionLoading} onClick={() => handleGeneratedImageReview('reject', item.id)}>Discard</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── DEVELOPER TOOLS ───────────────────────────────────────────── */}
      <details className={styles.section}>
        <summary className={styles.subtle} style={{ cursor: 'pointer', userSelect: 'none' }}>▸ Developer Tools</summary>
        <div style={{ marginTop: 12 }}>
          <div className={styles.row}>
            <span className={styles.subtle}>
              Comfy: {comfyStatus
                ? `${comfyStatus.available ? 'available' : 'unavailable'} @ ${comfyStatus.baseUrl || 'n/a'}`
                : 'not loaded'}
            </span>
            <button onClick={initialLoad} disabled={loading || actionLoading}>Refresh Panel</button>
          </div>
          <div className={styles.row} style={{ marginTop: 8 }}>
            <button disabled={!selectedWorkflowId || actionLoading} onClick={handleValidateWorkflow}>Validate Workflow</button>
          </div>
          {workflowValidation && <div className={styles.pre}>{JSON.stringify(workflowValidation, null, 2)}</div>}
          <div className={styles.row} style={{ marginTop: 8 }}>
            <button disabled={!selectedPromptPackId || !selectedWorkflowId || actionLoading} onClick={() => handleQueue(true)}>Dry-run Pack</button>
            <button disabled={!selectedPromptPackId || !selectedWorkflowId || actionLoading} onClick={() => handleQueue(false)}>Queue Single Pack</button>
          </div>
          {lastQueueResponse && <div className={styles.pre}>{JSON.stringify(lastQueueResponse, null, 2)}</div>}
          <div className={styles.row} style={{ marginTop: 8 }}>
            <button disabled={!promptId || actionLoading} onClick={handleJobStatus}>Check Job Status</button>
            <button disabled={!promptId || !selectedPromptPackId || actionLoading} onClick={handleIngest}>Ingest Outputs</button>
            <span className={styles.subtle}>Prompt ID: {promptId || '(none)'}</span>
          </div>
          {jobStatus && <div className={styles.pre}>{JSON.stringify(jobStatus, null, 2)}</div>}
          {ingestResult && <div className={styles.pre}>{JSON.stringify(ingestResult, null, 2)}</div>}
        </div>
      </details>
    </div>
  )
}
