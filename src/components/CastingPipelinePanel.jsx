import { useEffect, useMemo, useState } from 'react'
import {
  approveBatchCandidate,
  getCharacterBatch,
  listBatchCandidates,
  listCharacterBatches,
  listCharacters,
  rejectBatchCandidate,
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
import {
  approveGeneratedImage,
  listGeneratedImages,
  rejectGeneratedImage,
} from '../lib/api/generatedImages.js'
import { buildCharacterPortfolioPlan, queueCharacterPortfolio } from '../lib/api/portfolio.js'
import { listBankEntries } from '../lib/api/characterBank.js'
import styles from './CastingPipelinePanel.module.css'

function ErrorBanner({ message }) {
  if (!message) return null
  return <div className={styles.error}>{message}</div>
}

function SuccessBanner({ message }) {
  if (!message) return null
  return <div className={styles.success}>{message}</div>
}

export default function CastingPipelinePanel() {
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [comfyStatus, setComfyStatus] = useState(null)
  const [batches, setBatches] = useState([])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [candidates, setCandidates] = useState([])

  const [savedCharacterIds, setSavedCharacterIds] = useState([])
  const [selectedCharacterId, setSelectedCharacterId] = useState('')

  const [promptPacks, setPromptPacks] = useState([])
  const [selectedPromptPackId, setSelectedPromptPackId] = useState('')

  const [workflows, setWorkflows] = useState([])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('')
  const [showInvalidWorkflows, setShowInvalidWorkflows] = useState(false)
  const [workflowValidation, setWorkflowValidation] = useState(null)

  const [lastQueueResponse, setLastQueueResponse] = useState(null)
  const [jobStatus, setJobStatus] = useState(null)
  const [ingestResult, setIngestResult] = useState(null)
  const [generatedImages, setGeneratedImages] = useState([])
  const [imageLoadErrors, setImageLoadErrors] = useState({})
  const [portfolioViews, setPortfolioViews] = useState({
    front_portrait: true,
    three_quarter_portrait: true,
    profile_portrait: true,
    full_body: true,
    audition_still: true,
    cinematic_scene: false,
  })
  const [portfolioPlanResult, setPortfolioPlanResult] = useState(null)
  const [portfolioQueueResult, setPortfolioQueueResult] = useState(null)
  const [portfolioJobs, setPortfolioJobs] = useState([])
  const [portfolioJobsStatus, setPortfolioJobsStatus] = useState(null)
  const [portfolioIngestResult, setPortfolioIngestResult] = useState(null)
  const [bankEntries, setBankEntries] = useState([])
  const [selectedBankEntryId, setSelectedBankEntryId] = useState('')
  const [bankLoadError, setBankLoadError] = useState(null)

  const selectedBankEntry = useMemo(
    () => bankEntries.find((entry) => entry.id === selectedBankEntryId) || null,
    [bankEntries, selectedBankEntryId]
  )

  const selectableWorkflows = useMemo(() => {
    if (showInvalidWorkflows) return workflows
    return workflows.filter((w) => w.valid)
  }, [workflows, showInvalidWorkflows])

  const selectedPromptPack = useMemo(
    () => promptPacks.find((p) => p.id === selectedPromptPackId) || null,
    [promptPacks, selectedPromptPackId],
  )

  const promptId = lastQueueResponse?.promptId || ''

  async function initialLoad() {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const [batchResult, workflowResult, comfyResult, charactersResult] = await Promise.all([
        listCharacterBatches(),
        listComfyWorkflows(),
        getComfyStatus(),
        listCharacters().catch(() => ({ items: [] })),
      ])
      setBatches(batchResult.items || [])
      setWorkflows(workflowResult.workflows || [])
      setComfyStatus(comfyResult.comfy || null)
      const fromDb = (charactersResult.items || []).map((c) => c?.id).filter(Boolean)
      setSavedCharacterIds((prev) => [...new Set([...fromDb, ...prev])])
      if (!selectedWorkflowId) {
        const defaultValid = (workflowResult.workflows || []).find((w) => w.valid)
        if (defaultValid) setSelectedWorkflowId(defaultValid.workflowId)
      }
    } catch (err) {
      setError(err.message || 'Failed to load casting room data.')
    } finally {
      setLoading(false)
    }
  }

  async function refreshBatch(batchId) {
    if (!batchId) return
    setActionLoading(true)
    setError('')
    try {
      const [batchRes, candidateRes] = await Promise.all([
        getCharacterBatch(batchId),
        listBatchCandidates(batchId),
      ])
      setSelectedBatch(batchRes.item || null)
      setCandidates(candidateRes.items || [])
    } catch (err) {
      setError(err.message || 'Failed to refresh batch data.')
    } finally {
      setActionLoading(false)
    }
  }

  useEffect(() => {
    initialLoad()
  }, [])

  useEffect(() => {
    let cancelled = false
    listBankEntries()
      .then((data) => {
        if (cancelled) return
        const items = Array.isArray(data?.items) ? data.items : []
        setBankEntries(items)
        setBankLoadError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setBankLoadError(err?.message || 'Failed to load bank entries')
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    refreshBatch(selectedBatchId)
  }, [selectedBatchId])

  async function handleCandidateAction(action, candidateId) {
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      if (action === 'approve') await approveBatchCandidate(candidateId)
      if (action === 'reject') await rejectBatchCandidate(candidateId, 'Rejected manually in pipeline panel')
      if (action === 'save') {
        const saved = await saveBatchCandidate(candidateId)
        const newCharacterId = saved?.item?.savedCharacterId
        if (newCharacterId) {
          setSavedCharacterIds((prev) => [...new Set([...prev, newCharacterId])])
          setSelectedCharacterId(newCharacterId)
          setSuccess(`Saved candidate as character: ${newCharacterId}`)
        }
      }
      await refreshBatch(selectedBatchId)
      if (action !== 'save') setSuccess(`Candidate ${action}d.`)
    } catch (err) {
      setError(err.message || `Failed to ${action} candidate.`)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCompilePromptPacks() {
    if (!selectedCharacterId) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const compiled = await compilePromptPacksForCharacter(selectedCharacterId, selectedWorkflowId)
      setSuccess(`Compiled ${compiled?.packs?.length || 0} prompt pack(s).`)
      const listed = await listPromptPacksForCharacter(selectedCharacterId)
      setPromptPacks(listed.items || [])
      if ((listed.items || []).length > 0) setSelectedPromptPackId(listed.items[0].id)
    } catch (err) {
      setError(err.message || 'Failed to compile prompt packs.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleLoadPromptPacks() {
    if (!selectedCharacterId) return
    setActionLoading(true)
    setError('')
    try {
      const listed = await listPromptPacksForCharacter(selectedCharacterId)
      setPromptPacks(listed.items || [])
      if ((listed.items || []).length > 0 && !selectedPromptPackId) {
        setSelectedPromptPackId(listed.items[0].id)
      }
    } catch (err) {
      setError(err.message || 'Failed to list prompt packs.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleValidateWorkflow() {
    if (!selectedWorkflowId) return
    setActionLoading(true)
    setError('')
    try {
      const result = await validateComfyWorkflow(selectedWorkflowId)
      setWorkflowValidation(result)
      if (result.ok) setSuccess('Workflow validation passed.')
    } catch (err) {
      setError(err.message || 'Workflow validation failed.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleQueue(dryRun) {
    if (!selectedPromptPackId || !selectedWorkflowId) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const result = await queueComfyPromptPack({
        promptPackId: selectedPromptPackId,
        workflowId: selectedWorkflowId,
        dryRun,
      })
      setLastQueueResponse(result)
      if (dryRun) setSuccess('Dry-run complete.')
      else setSuccess(`Queued prompt successfully. Prompt ID: ${result.promptId || '(none)'}`)
    } catch (err) {
      setError(err.message || 'Queue request failed.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleJobStatus() {
    if (!promptId) return
    setActionLoading(true)
    setError('')
    try {
      const result = await getComfyJobStatus(promptId)
      setJobStatus(result)
    } catch (err) {
      setError(err.message || 'Failed to check job status.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleIngest() {
    if (!promptId || !selectedPromptPackId) return
    setActionLoading(true)
    setError('')
    try {
      const result = await ingestComfyOutputs({
        promptId,
        promptPackId: selectedPromptPackId,
        workflowVersion: selectedWorkflowId,
        characterId: selectedCharacterId || selectedPromptPack?.characterId,
        viewType: 'front_portrait',
      })
      setIngestResult(result)
      setSuccess(`Ingested ${result.created || 0} output image(s).`)
      await refreshGallery()
    } catch (err) {
      setError(err.message || 'Ingest failed.')
    } finally {
      setActionLoading(false)
    }
  }

  async function refreshGallery() {
    setActionLoading(true)
    setError('')
    try {
      // Prefer characterId when set so the gallery shows every ingested image for that
      // character across prompt packs. Prompt-pack-only filter applies when no character
      // is selected (otherwise compile auto-selects a pack and would hide other packs).
      const filters = selectedCharacterId
        ? { characterId: selectedCharacterId, limit: 100 }
        : selectedPromptPackId
          ? { promptPackId: selectedPromptPackId, limit: 100 }
          : { limit: 100 }
      const result = await listGeneratedImages(filters)
      setGeneratedImages(result.items || [])
      setImageLoadErrors({})
    } catch (err) {
      setError(err.message || 'Failed to load generated images.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleGeneratedImageReview(action, id) {
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      if (action === 'approve') await approveGeneratedImage(id)
      if (action === 'reject') await rejectGeneratedImage(id, 'Rejected manually in gallery')
      await refreshGallery()
      setSuccess(`Generated image ${action}d.`)
    } catch (err) {
      setError(err.message || `Failed to ${action} generated image.`)
    } finally {
      setActionLoading(false)
    }
  }

  function selectedPortfolioViews() {
    return Object.entries(portfolioViews).filter(([, enabled]) => enabled).map(([view]) => view)
  }

  async function handleBuildPortfolioPlan() {
    const views = selectedPortfolioViews()
    if (!selectedCharacterId || !selectedWorkflowId || views.length === 0) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const result = await buildCharacterPortfolioPlan({
        characterId: selectedCharacterId,
        views,
        workflowId: selectedWorkflowId,
        options: {
          persistPromptPacks: true,
          aspectRatio: '2:3',
          styleProfile: 'cinematic casting portrait',
        },
      })
      setPortfolioPlanResult(result)
      setSuccess(`Portfolio plan ready for ${result.totalViews} view(s).`)
    } catch (err) {
      setError(err.message || 'Failed to build portfolio plan.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleQueuePortfolio() {
    const views = selectedPortfolioViews()
    if (!selectedCharacterId || !selectedWorkflowId || views.length === 0) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const result = await queueCharacterPortfolio({
        characterId: selectedCharacterId,
        views,
        workflowId: selectedWorkflowId,
        options: {
          persistPromptPacks: true,
          aspectRatio: '2:3',
          styleProfile: 'cinematic casting portrait',
        },
      })
      setPortfolioQueueResult(result)
      const jobs = (result.queued || [])
        .filter((item) => item.ok && item.result?.promptId)
        .map((item) => ({
          promptId: item.result.promptId,
          promptPackId: item.promptPackId,
          view: item.view,
          characterId: selectedCharacterId,
          workflowVersion: selectedWorkflowId,
          viewType: item.view,
        }))
      setPortfolioJobs(jobs)
      setSuccess(`Portfolio queue finished. Success: ${result.summary?.success || 0}, Failed: ${result.summary?.failed || 0}`)
    } catch (err) {
      setError(err.message || 'Failed to queue portfolio.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCheckPortfolioStatus() {
    if (!portfolioJobs.length) return
    setActionLoading(true)
    setError('')
    try {
      const result = await getComfyJobsStatus(portfolioJobs)
      setPortfolioJobsStatus(result)
      setSuccess('Checked portfolio job statuses.')
    } catch (err) {
      setError(err.message || 'Failed to check portfolio status.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleIngestPortfolioOutputs() {
    if (!portfolioJobs.length) return
    setActionLoading(true)
    setError('')
    try {
      const statusItems = portfolioJobsStatus?.items || []
      const successfulPromptIds = new Set(
        statusItems.filter((item) => item.ok && item.status === 'success').map((item) => item.promptId),
      )
      const ingestJobs = portfolioJobs.filter((job) => successfulPromptIds.has(job.promptId))
      if (ingestJobs.length === 0) {
        setError('No completed successful portfolio jobs to ingest.')
        return
      }
      const result = await ingestComfyOutputsMany(ingestJobs)
      setPortfolioIngestResult(result)
      setSuccess(`Portfolio ingest complete. Success: ${result.summary?.success || 0}, Failed: ${result.summary?.failed || 0}`)
      await refreshGallery()
    } catch (err) {
      setError(err.message || 'Failed to ingest portfolio outputs.')
    } finally {
      setActionLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedCharacterId && !selectedPromptPackId) return
    refreshGallery()
  }, [selectedCharacterId, selectedPromptPackId])

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Casting Room</h2>
      <p className={styles.subtle}>Manual operator controls for batch review, prompt-pack compile, Comfy queue, status, and ingest.</p>
      {loading && <div className={styles.subtle}>Loading...</div>}
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <section className={styles.section}>
        <h3>Cast from Bank</h3>
        {bankLoadError && (
          <div className={styles.subtle}>Bank unavailable: {bankLoadError}</div>
        )}
        {!bankLoadError && bankEntries.length === 0 && (
          <div className={styles.subtle}>
            No bank characters yet. Sync characters from the Character Builder tab to populate this list.
          </div>
        )}
        {!bankLoadError && bankEntries.length > 0 && (
          <>
            <div className={styles.row}>
              <select
                value={selectedBankEntryId}
                onChange={(e) => setSelectedBankEntryId(e.target.value)}
                className={styles.select}
              >
                <option value="">Select a character...</option>
                {bankEntries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    @{entry.slug} — {entry.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedBankEntry && (
              <div className={styles.subtle}>
                <div><strong>{selectedBankEntry.name}</strong> (@{selectedBankEntry.slug})</div>
                <div>{selectedBankEntry.description}</div>
              </div>
            )}
          </>
        )}
      </section>

      <section className={styles.section}>
        <h3>Comfy Status</h3>
        <div className={styles.row}>
          <button onClick={initialLoad} disabled={loading || actionLoading}>Refresh Panel Data</button>
          <span className={styles.subtle}>
            {comfyStatus ? `available: ${String(comfyStatus.available)} @ ${comfyStatus.baseUrl || 'n/a'}` : 'No status loaded'}
          </span>
        </div>
      </section>

      <section className={styles.section}>
        <h3>Batches</h3>
        {batches.length === 0 ? (
          <div className={styles.subtle}>No batches found.</div>
        ) : (
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className={styles.select}
          >
            <option value="">Select a batch...</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.id} ({batch.status})
              </option>
            ))}
          </select>
        )}
        {selectedBatch && (
          <div className={styles.subtle}>Selected batch: {selectedBatch.id} | status: {selectedBatch.status}</div>
        )}
      </section>

      <section className={styles.section}>
        <h3>Candidates</h3>
        {selectedBatchId && candidates.length === 0 && <div className={styles.subtle}>No candidates in this batch.</div>}
        <div className={styles.list}>
          {candidates.map((candidate) => (
            <div className={styles.item} key={candidate.id}>
              <div className={styles.itemTitle}>{candidate.id}</div>
              <div className={styles.subtle}>
                {candidate.reviewStatus} / {candidate.classification} | {candidate.candidate?.name || 'unnamed'}
              </div>
              <div className={styles.row}>
                <button disabled={actionLoading} onClick={() => handleCandidateAction('approve', candidate.id)}>Approve</button>
                <button disabled={actionLoading} onClick={() => handleCandidateAction('reject', candidate.id)}>Reject</button>
                <button
                  disabled={actionLoading || candidate.reviewStatus !== 'approved'}
                  onClick={() => handleCandidateAction('save', candidate.id)}
                >
                  Save
                </button>
                {candidate.savedCharacterId && (
                  <span className={styles.subtle}>savedCharacterId: {candidate.savedCharacterId}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3>Saved Character</h3>
        <div className={styles.row}>
          <select
            value={selectedCharacterId}
            onChange={(e) => setSelectedCharacterId(e.target.value)}
            className={styles.select}
          >
            <option value="">Select saved character...</option>
            {savedCharacterIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
          <button disabled={actionLoading || !selectedCharacterId} onClick={handleCompilePromptPacks}>
            Compile Prompt Packs
          </button>
          <button disabled={actionLoading || !selectedCharacterId} onClick={handleLoadPromptPacks}>
            List Prompt Packs
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h3>Prompt Packs</h3>
        {promptPacks.length === 0 ? (
          <div className={styles.subtle}>No prompt packs loaded.</div>
        ) : (
          <select
            value={selectedPromptPackId}
            onChange={(e) => setSelectedPromptPackId(e.target.value)}
            className={styles.select}
          >
            <option value="">Select prompt pack...</option>
            {promptPacks.map((pack) => (
              <option key={pack.id} value={pack.id}>{pack.id}</option>
            ))}
          </select>
        )}
      </section>

      <section className={styles.section}>
        <h3>Workflow</h3>
        <label className={styles.subtle}>
          <input
            type="checkbox"
            checked={showInvalidWorkflows}
            onChange={(e) => setShowInvalidWorkflows(e.target.checked)}
          />{' '}
          Show invalid workflows
        </label>
        <div className={styles.row}>
          <select
            value={selectedWorkflowId}
            onChange={(e) => setSelectedWorkflowId(e.target.value)}
            className={styles.select}
          >
            <option value="">Select workflow...</option>
            {selectableWorkflows.map((workflow) => (
              <option key={workflow.workflowId} value={workflow.workflowId}>
                {workflow.workflowId} {workflow.valid ? '' : '(invalid)'}
              </option>
            ))}
          </select>
          <button disabled={!selectedWorkflowId || actionLoading} onClick={handleValidateWorkflow}>
            Validate Workflow
          </button>
        </div>
        {workflowValidation && (
          <div className={styles.pre}>{JSON.stringify(workflowValidation, null, 2)}</div>
        )}
      </section>

      <section className={styles.section}>
        <h3>Comfy Queue</h3>
        <div className={styles.row}>
          <button
            disabled={!selectedPromptPackId || !selectedWorkflowId || actionLoading}
            onClick={() => handleQueue(true)}
          >
            Dry-run
          </button>
          <button
            disabled={!selectedPromptPackId || !selectedWorkflowId || actionLoading}
            onClick={() => handleQueue(false)}
          >
            Queue Real Generation
          </button>
        </div>
        {lastQueueResponse && (
          <div className={styles.pre}>{JSON.stringify(lastQueueResponse, null, 2)}</div>
        )}
      </section>

      <section className={styles.section}>
        <h3>Character Portfolio</h3>
        <div className={styles.subtle}>Build/queue standard multi-view packs for selected saved character.</div>
        <div className={styles.row}>
          {Object.keys(portfolioViews).map((view) => (
            <label key={view} className={styles.subtle}>
              <input
                type="checkbox"
                checked={portfolioViews[view]}
                onChange={(e) => setPortfolioViews((prev) => ({ ...prev, [view]: e.target.checked }))}
              />{' '}
              {view}
            </label>
          ))}
        </div>
        <div className={styles.row}>
          <button
            disabled={!selectedCharacterId || !selectedWorkflowId || selectedPortfolioViews().length === 0 || actionLoading}
            onClick={handleBuildPortfolioPlan}
          >
            Build Portfolio Plan
          </button>
          <button
            disabled={!selectedCharacterId || !selectedWorkflowId || selectedPortfolioViews().length === 0 || actionLoading}
            onClick={handleQueuePortfolio}
          >
            Queue Portfolio
          </button>
        </div>
        {portfolioPlanResult && <div className={styles.pre}>{JSON.stringify(portfolioPlanResult, null, 2)}</div>}
        {portfolioQueueResult && <div className={styles.pre}>{JSON.stringify(portfolioQueueResult, null, 2)}</div>}
        <div className={styles.row}>
          <button
            disabled={!portfolioJobs.length || actionLoading}
            onClick={handleCheckPortfolioStatus}
          >
            Check Portfolio Status
          </button>
          <button
            disabled={!portfolioJobs.length || !portfolioJobsStatus || actionLoading}
            onClick={handleIngestPortfolioOutputs}
          >
            Ingest Completed Portfolio Outputs
          </button>
        </div>
        {portfolioJobs.length > 0 && (
          <div className={styles.list}>
            {portfolioJobs.map((job) => {
              const status = portfolioJobsStatus?.items?.find((x) => x.promptId === job.promptId)
              return (
                <div className={styles.item} key={job.promptId}>
                  <div className={styles.itemTitle}>{job.view}</div>
                  <div className={styles.subtle}>promptPackId: {job.promptPackId}</div>
                  <div className={styles.subtle}>promptId: {job.promptId}</div>
                  <div className={styles.subtle}>status: {status?.status || (status?.ok === false ? 'failed' : 'unknown')}</div>
                  {status?.error && <div className={styles.error}>{status.error}</div>}
                </div>
              )
            })}
          </div>
        )}
        {portfolioJobsStatus && <div className={styles.pre}>{JSON.stringify(portfolioJobsStatus, null, 2)}</div>}
        {portfolioIngestResult && <div className={styles.pre}>{JSON.stringify(portfolioIngestResult, null, 2)}</div>}
      </section>

      <section className={styles.section}>
        <h3>Job + Ingest</h3>
        <div className={styles.row}>
          <button disabled={!promptId || actionLoading} onClick={handleJobStatus}>
            Check Job Status
          </button>
          <button
            disabled={!promptId || !selectedPromptPackId || actionLoading}
            onClick={handleIngest}
          >
            Ingest Outputs
          </button>
          <span className={styles.subtle}>Prompt ID: {promptId || '(none)'}</span>
        </div>
        {jobStatus && <div className={styles.pre}>{JSON.stringify(jobStatus, null, 2)}</div>}
        {ingestResult && (
          <div>
            <div className={styles.pre}>{JSON.stringify(ingestResult, null, 2)}</div>
            {Array.isArray(ingestResult.items) && ingestResult.items.length > 0 && (
              <div className={styles.list}>
                {ingestResult.items.map((item) => (
                  <div key={item.id} className={styles.item}>
                    <div className={styles.itemTitle}>{item.id}</div>
                    <div className={styles.subtle}>{item.imagePath}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h3>Generated Images / Gallery</h3>
        <div className={styles.row}>
          <button
            disabled={actionLoading || (!selectedCharacterId && !selectedPromptPackId)}
            onClick={refreshGallery}
          >
            Refresh Gallery
          </button>
          <span className={styles.subtle}>
            {selectedCharacterId
              ? `Filter: characterId=${selectedCharacterId} (all packs)`
              : selectedPromptPackId
                ? `Filter: promptPackId=${selectedPromptPackId}`
                : 'Select character or prompt pack to filter gallery'}
          </span>
        </div>
        {generatedImages.length === 0 ? (
          <div className={styles.subtle}>No generated images found for current filter.</div>
        ) : (
          <div className={styles.galleryGrid}>
            {generatedImages.map((item) => (
              <div className={styles.item} key={item.id}>
                <div className={styles.itemTitle}>{item.id}</div>
                <img
                  className={styles.preview}
                  src={`/api/generated-image-view?id=${encodeURIComponent(item.id)}`}
                  alt={item.imagePath || item.id}
                  onError={() => setImageLoadErrors((prev) => ({ ...prev, [item.id]: 'Image preview failed to load.' }))}
                />
                {imageLoadErrors[item.id] && <div className={styles.error}>{imageLoadErrors[item.id]}</div>}
                <div className={styles.subtle}>characterId: {item.characterId || '(none)'}</div>
                <div className={styles.subtle}>promptPackId: {item.promptPackId}</div>
                <div className={styles.subtle}>viewType: {item.viewType}</div>
                <div className={styles.subtle}>workflowVersion: {item.workflowVersion || '(none)'}</div>
                <div className={styles.subtle}>seed: {Number.isInteger(item.seed) ? item.seed : '(none)'}</div>
                <div className={styles.subtle}>approved: {String(item.approved)}</div>
                <div className={styles.row}>
                  <button disabled={actionLoading} onClick={() => handleGeneratedImageReview('approve', item.id)}>
                    Approve
                  </button>
                  <button disabled={actionLoading} onClick={() => handleGeneratedImageReview('reject', item.id)}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

