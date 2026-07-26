import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { NEGATIVE_PROMPT } from '../data/chips.js'
import { usePolish } from '../hooks/usePolish.js'
import { scorePromptQuality } from '../utils/qualityScore.js'
import { downloadPromptTxt } from '../utils/downloadPromptFile.js'
import { listGeneratedImages } from '../lib/api/generatedImages.js'
import {
  getComfyJobsStatus,
  ingestComfyOutputs,
  queueBuilderPromptRender,
} from '../lib/api/comfy.js'
import { fetchSavedPrompts, createSavedPromptRemote, deleteSavedPromptRemote, renameSavedPromptRemote } from '../api/promptStorage.js'
import styles from './PromptOutput.module.css'

const DEFAULT_FRONT_PREFIX = 'photorealistic film still'
const HISTORY_KEY = 'qpb_prompt_history_v1'
const HISTORY_LIMIT = 12
const SAVED_PROMPTS_KEY = 'qpb_saved_prompts_v1'
const LOCAL_PROVIDER_KEY = 'qpb_local_provider_v1'
const LMSTUDIO_HOST_KEY = 'qpb_lmstudio_host_v1'
const LMSTUDIO_PORT_KEY = 'qpb_lmstudio_port_v1'
const LMSTUDIO_MODEL_KEY = 'qpb_lmstudio_model_v1'
const COMPARE_RENDERS_SESSION_KEY = 'qpb_compare_renders_v1'

function parseCompareSlotRecord(raw) {
  if (!raw || typeof raw !== 'object') return null
  const images = Array.isArray(raw.images)
    ? raw.images.filter((img) => img && typeof img.id === 'string' && img.id.trim())
    : []
  const promptSnippet = typeof raw.promptSnippet === 'string' ? raw.promptSnippet.slice(0, 500) : ''
  const ts = Number(raw.timestamp)
  const timestamp = Number.isFinite(ts) ? ts : Date.now()
  if (images.length === 0 && !promptSnippet) return null
  return { images, promptSnippet, timestamp }
}

function readCompareRendersFromSession() {
  try {
    const raw = sessionStorage.getItem(COMPARE_RENDERS_SESSION_KEY)
    if (!raw) return { A: null, B: null }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { A: null, B: null }
    return {
      A: parseCompareSlotRecord(parsed.A),
      B: parseCompareSlotRecord(parsed.B),
    }
  } catch {
    return { A: null, B: null }
  }
}

function writeCompareRendersToSession(next) {
  try {
    const pack = (slot) => {
      const v = next[slot]
      if (!v || !Array.isArray(v.images) || v.images.length === 0) return null
      return {
        images: v.images.map((img) => ({ id: String(img.id) })),
        promptSnippet: String(v.promptSnippet ?? '').slice(0, 500),
        timestamp: Number(v.timestamp) || Date.now(),
      }
    }
    const payload = { A: pack('A'), B: pack('B') }
    if (!payload.A && !payload.B) {
      sessionStorage.removeItem(COMPARE_RENDERS_SESSION_KEY)
    } else {
      sessionStorage.setItem(COMPARE_RENDERS_SESSION_KEY, JSON.stringify(payload))
    }
  } catch {
    /* quota or private mode */
  }
}

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readLocalSetting(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return typeof raw === 'string' && raw.trim() ? raw.trim() : fallback
  } catch {
    return fallback
  }
}

function CopyButton({ text, label = 'Copy' }) {
  const [state, setState] = useState('idle')

  const handleCopy = useCallback(async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2000)
    }
  }, [text])

  return (
    <button
      className={`${styles.copyBtn} ${state === 'copied' ? styles.copied : ''}`}
      onClick={handleCopy}
      disabled={!text}
    >
      {state === 'copied' ? '✓ Copied' : state === 'error' ? 'Failed' : label}
    </button>
  )
}

export default function PromptOutput({
  prompt, // string[] — assembled from chips
  scene, // string — raw scene input
  scenario, // string | null — selected scenario
  chips = {},
  variants = [],
  issues = [],
  onApplyRuleFix,
  onShareState,
  directorName, // string | null — e.g. "Andrei Tarkovsky"
  directorNote, // string | null — director register line for polish (note or style key)
  narrativeBeat = null, // string | null — ideation seed passed to polish as narrative context
  applyDiff = null, // {source, timestamp, changes:[{kind,text}]} | null
  isApplyDiffPinned = false,
  onPinApplyDiff,
  onClearApplyDiff,
  exportFilenameBase = 'qwen-prompt',
  promptExportRef, // optional ref object: { current: null | () => void } for command palette export
  aiEngine = 'auto',
  localOnly = false,
  embeddedStatus = null,
  comfyStatus = null,
  comfyError = '',
  entityId = null,
}) {
  const isDev = import.meta.env.DEV
  const [showNeg, setShowNeg] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [useFrontPrefix, setUseFrontPrefix] = useState(true)
  const [showVariants, setShowVariants] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [restoredText, setRestoredText] = useState(null)
  const [manualEdit, setManualEdit] = useState(null)
  const [isManualEditMode, setIsManualEditMode] = useState(false)
  const [history, setHistory] = useState(() => readHistory())
  const textareaRef = useRef(null)
  const [showHistory, setShowHistory] = useState(false)
  const [savedPrompts, setSavedPrompts] = useState([])
  const [showSaved, setShowSaved] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [galleryImages, setGalleryImages] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [renderState, setRenderState] = useState('idle')
  const [renderJob, setRenderJob] = useState(null)
  const [renderImages, setRenderImages] = useState([])
  const [renderError, setRenderError] = useState('')
  const [showRenderResults, setShowRenderResults] = useState(false)
  const renderPollRef = useRef(null)
  const [diffTargetId, setDiffTargetId] = useState(null)
  const [shareState, setShareState] = useState('idle')
  const [debugCopyState, setDebugCopyState] = useState('idle')
  const [showQualityHints, setShowQualityHints] = useState(false)
  const [snapshotA, setSnapshotA] = useState(null)
  const [snapshotB, setSnapshotB] = useState(null)
  /** Last successful Comfy renders for snapshot A/B compare (also restored from sessionStorage). */
  const [lastCompareRender, setLastCompareRender] = useState(readCompareRendersFromSession)
  const [compareSlotError, setCompareSlotError] = useState({ A: '', B: '' })
  /** 'main' | 'A' | 'B' while a Comfy job is active (set before renderJob ids exist, for per-button spinners). */
  const [activeRenderSlot, setActiveRenderSlot] = useState(null)
  const [health, setHealth] = useState(null)
  const [healthError, setHealthError] = useState('')
  const [localProvider, setLocalProvider] = useState(() => readLocalSetting(LOCAL_PROVIDER_KEY, 'ollama'))
  const [lmStudioHost, setLmStudioHost] = useState(() => readLocalSetting(LMSTUDIO_HOST_KEY, '127.0.0.1'))
  const [lmStudioPort, setLmStudioPort] = useState(() => readLocalSetting(LMSTUDIO_PORT_KEY, '1234'))
  const [lmStudioModel, setLmStudioModel] = useState(() => readLocalSetting(LMSTUDIO_MODEL_KEY, 'qwen-local'))
  const [lmStudioValidation, setLmStudioValidation] = useState({ status: 'idle', message: '' })
  const { state, polished, error, debug, polish, revert, checkHealth } = usePolish()

  const lmStudioBaseUrl = useMemo(() => {
    const host = (lmStudioHost || '').trim()
    const port = (lmStudioPort || '').trim()
    if (!host || !port) return ''
    return `http://${host}:${port}/v1`
  }, [lmStudioHost, lmStudioPort])

  const hasContent = prompt.length > 0
  const isAssembled = !!(scene?.trim() || scenario)
  const isPolished = state === 'polished' && polished
  const hasVariantOverride = !!selectedVariant
  const assembledText = prompt.join(', ')

  // What we actually display and copy
  const displayText = manualEdit !== null
    ? manualEdit
    : restoredText
    ? restoredText
    : hasVariantOverride
    ? selectedVariant.text
    : isPolished
      ? polished
      : assembledText
  const displayFragments = manualEdit !== null
    ? [manualEdit]
    : restoredText
    ? [restoredText]
    : hasVariantOverride
    ? [selectedVariant.text]
    : isPolished
    ? [polished] // show as one block when polished
    : prompt // show as individual fragments when assembled

  const hasManualEdit = manualEdit !== null
  const isEditable = hasContent

  const enterManualEditMode = useCallback(() => {
    if (!isEditable) return
    setIsManualEditMode(true)
    setManualEdit((prev) => (prev === null ? displayText : prev))
  }, [isEditable, displayText])

  const exitManualEditMode = useCallback(() => {
    setIsManualEditMode(false)
  }, [])

  const qualityReport = useMemo(
    () => scorePromptQuality({
      assembledText: displayText,
      chips,
      scenario,
      scene,
    }),
    [displayText, chips, scenario, scene],
  )

  useEffect(() => {
    if (!promptExportRef) return
    promptExportRef.current = () => {
      downloadPromptTxt({
        positive: displayText,
        negative: NEGATIVE_PROMPT,
        filenameBase: exportFilenameBase,
      })
    }
    return () => {
      promptExportRef.current = null
    }
  }, [displayText, exportFilenameBase, promptExportRef])

  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        const info = await checkHealth({
          engine: aiEngine,
          localOnly: aiEngine === 'cloud' ? false : localOnly,
          embeddedPort: embeddedStatus?.port ?? null,
          embeddedSecret: embeddedStatus?.secret ?? null,
          localProvider,
          lmStudioBaseUrl: localProvider === 'lmstudio' ? lmStudioBaseUrl : null,
          lmStudioModel: localProvider === 'lmstudio' ? lmStudioModel : null,
        })
        if (!active) return
        setHealth(info)
        setHealthError('')
      } catch (err) {
        if (!active) return
        setHealth(null)
        setHealthError(err?.message ?? 'Health check failed')
      }
    }
    run()
    return () => { active = false }
  }, [aiEngine, localOnly, embeddedStatus, checkHealth, localProvider, lmStudioBaseUrl, lmStudioModel])

  // Load saved prompts from DB; migrate any existing localStorage entries on first run.
  useEffect(() => {
    let active = true
    fetchSavedPrompts().then((items) => {
      if (!active) return
      if (items.length === 0) {
        // One-time migration from localStorage
        try {
          const raw = localStorage.getItem(SAVED_PROMPTS_KEY)
          const legacy = raw ? JSON.parse(raw) : []
          if (Array.isArray(legacy) && legacy.length) {
            Promise.all(legacy.map((e) => createSavedPromptRemote({ id: e.id, name: e.name, text: e.text }).catch(() => null)))
              .then(() => fetchSavedPrompts())
              .then((migrated) => { if (active) { setSavedPrompts(migrated); localStorage.removeItem(SAVED_PROMPTS_KEY) } })
            return
          }
        } catch { /* ignore */ }
      }
      setSavedPrompts(items)
    }).catch(() => { /* API unavailable — leave empty */ })
    return () => { active = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem(LOCAL_PROVIDER_KEY, localProvider)
  }, [localProvider])

  useEffect(() => {
    localStorage.setItem(LMSTUDIO_HOST_KEY, lmStudioHost)
  }, [lmStudioHost])

  useEffect(() => {
    localStorage.setItem(LMSTUDIO_PORT_KEY, lmStudioPort)
  }, [lmStudioPort])

  useEffect(() => {
    localStorage.setItem(LMSTUDIO_MODEL_KEY, lmStudioModel)
  }, [lmStudioModel])

  const handleExportTxt = useCallback(() => {
    downloadPromptTxt({
      positive: displayText,
      negative: NEGATIVE_PROMPT,
      filenameBase: exportFilenameBase,
    })
  }, [displayText, exportFilenameBase])

  const handleTextareaChange = useCallback((e) => {
    const value = e.target.value
    setManualEdit(value)
  }, [])

  const handleResetToAssembled = useCallback(() => {
    setManualEdit(null)
    setRestoredText(null)
    setSelectedVariant(null)
    setIsManualEditMode(false)
  }, [])

  const handleDiscardManualEdits = useCallback(() => {
    setManualEdit(null)
    setIsManualEditMode(false)
  }, [])

  const saveSnapshot = useCallback((slot) => {
    const text = displayText.trim()
    if (!text) return
    const snapshot = {
      text,
      timestamp: Date.now(),
      source: hasManualEdit ? 'manual' : isPolished ? 'polished' : 'assembled',
    }
    if (slot === 'A') setSnapshotA(snapshot)
    if (slot === 'B') setSnapshotB(snapshot)
  }, [displayText, hasManualEdit, isPolished])

  const loadSnapshot = useCallback((slot) => {
    const snapshot = slot === 'A' ? snapshotA : snapshotB
    if (!snapshot?.text) return
    setManualEdit(snapshot.text)
    setIsManualEditMode(true)
    setRestoredText(null)
    setSelectedVariant(null)
  }, [snapshotA, snapshotB])

  const clearCompareSlot = useCallback((slot) => {
    setLastCompareRender((prev) => ({ ...prev, [slot]: null }))
    setCompareSlotError((prev) => ({ ...prev, [slot]: '' }))
  }, [])

  const clearAllCompareRenders = useCallback(() => {
    setLastCompareRender({ A: null, B: null })
    setCompareSlotError({ A: '', B: '' })
  }, [])

  useEffect(() => {
    writeCompareRendersToSession(lastCompareRender)
  }, [lastCompareRender])

  // Auto-grow textarea effect
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [displayText, isManualEditMode])

  // Clear selected variant when assembled prompt changes so stale variant text is never shown.
  useEffect(() => { setSelectedVariant(null) }, [assembledText])



  const handlePolish = () => {
    setRestoredText(null)
    setManualEdit(null)
    setIsManualEditMode(false)
    setSelectedVariant(null)
    polish({
      fragments: prompt,
      directorName,
      directorNote,
      scene,
      scenario,
      frontPrefix: useFrontPrefix ? DEFAULT_FRONT_PREFIX : '',
      narrativeBeat,
      engine: aiEngine,
      localOnly,
      dryRun,
      embeddedPort: embeddedStatus?.port ?? null,
      embeddedSecret: embeddedStatus?.secret ?? null,
      localProvider,
      lmStudioBaseUrl: localProvider === 'lmstudio' ? lmStudioBaseUrl : null,
      lmStudioModel: localProvider === 'lmstudio' ? lmStudioModel : null,
      cloudProvider: aiEngine === 'cloud' ? 'claude' : null,
      entityId,
    })
  }

  const handlePolishCurrentText = useCallback(() => {
    const sourceText = displayText.trim()
    if (!sourceText) return
    setRestoredText(null)
    setManualEdit(null)
    setIsManualEditMode(false)
    setSelectedVariant(null)
    polish({
      fragments: [sourceText],
      directorName,
      directorNote,
      scene: null,
      scenario: null,
      frontPrefix: useFrontPrefix ? DEFAULT_FRONT_PREFIX : '',
      narrativeBeat: null,
      engine: aiEngine,
      localOnly,
      dryRun,
      embeddedPort: embeddedStatus?.port ?? null,
      embeddedSecret: embeddedStatus?.secret ?? null,
      localProvider,
      lmStudioBaseUrl: localProvider === 'lmstudio' ? lmStudioBaseUrl : null,
      lmStudioModel: localProvider === 'lmstudio' ? lmStudioModel : null,
      cloudProvider: aiEngine === 'cloud' ? 'claude' : null,
      entityId,
    })
  }, [
    displayText,
    polish,
    directorName,
    directorNote,
    entityId,
    useFrontPrefix,
    aiEngine,
    localOnly,
    dryRun,
    embeddedStatus,
    localProvider,
    lmStudioBaseUrl,
    lmStudioModel,
  ])

  const pushHistory = useCallback((kind, text) => {
    const value = (text ?? '').trim()
    if (!value) return
    setHistory((prev) => {
      const deduped = prev.filter((entry) => entry.text !== value)
      const next = [{
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind,
        text: value,
        timestamp: Date.now(),
      }, ...deduped].slice(0, HISTORY_LIMIT)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  useEffect(() => {
    if (assembledText.trim()) pushHistory('assembled', assembledText)
  }, [assembledText, pushHistory])

  useEffect(() => {
    if (isPolished && polished) pushHistory('polished', polished)
  }, [isPolished, polished, pushHistory])

  useEffect(() => {
    if (selectedVariant?.text) pushHistory('variant', selectedVariant.text)
  }, [selectedVariant, pushHistory])

  const diffTarget = history.find((entry) => entry.id === diffTargetId) ?? null
  const diffData = useMemo(() => {
    if (!diffTarget) return null
    const currentTokens = new Set(displayText.split(/\s+/).filter(Boolean))
    const targetTokens = new Set(diffTarget.text.split(/\s+/).filter(Boolean))
    const removed = [...currentTokens].filter((t) => !targetTokens.has(t)).slice(0, 25)
    const added = [...targetTokens].filter((t) => !currentTokens.has(t)).slice(0, 25)
    return { removed, added }
  }, [diffTarget, displayText])

  const debugPayload = useMemo(() => ({
    assembledPrompt: assembledText,
    requestState: state,
    dryRun,
    selectedEngine: debug?.lastRequest?.engine ?? aiEngine,
    localOnly: debug?.lastRequest?.localOnly ?? localOnly,
    localProvider: debug?.lastRequest?.localProvider ?? localProvider,
    lmStudioBaseUrl: debug?.lastRequest?.lmStudioBaseUrl ?? (localProvider === 'lmstudio' ? lmStudioBaseUrl : null),
    lmStudioModel: debug?.lastRequest?.lmStudioModel ?? (localProvider === 'lmstudio' ? lmStudioModel : null),
    provider: debug?.lastResponse?.provider ?? null,
    fallback: debug?.lastResponse?.fallback ?? null,
    lastError: debug?.lastError ?? error ?? null,
    lastRequest: debug?.lastRequest ?? null,
    lastResponse: debug?.lastResponse ?? null,
  }), [assembledText, state, dryRun, debug, aiEngine, localOnly, localProvider, lmStudioBaseUrl, lmStudioModel, error])

  const handleCopyDebugJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugPayload, null, 2))
      setDebugCopyState('copied')
      setTimeout(() => setDebugCopyState('idle'), 2000)
    } catch {
      setDebugCopyState('error')
      setTimeout(() => setDebugCopyState('idle'), 2000)
    }
  }, [debugPayload])

  const handleShare = async () => {
    if (!onShareState) return
    try {
      await onShareState()
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 2000)
    } catch {
      setShareState('error')
      setTimeout(() => setShareState('idle'), 2000)
    }
  }

  const handleSavePrompt = useCallback(async () => {
    const text = displayText.trim()
    if (!text) return
    const name = window.prompt('Save prompt as:')
    if (!name?.trim()) return
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: name.trim(), text }
    try {
      await createSavedPromptRemote(entry)
      setSavedPrompts(await fetchSavedPrompts())
    } catch { /* non-critical */ }
  }, [displayText])

  const handleDeleteSavedPrompt = useCallback(async (id) => {
    try {
      await deleteSavedPromptRemote(id)
      setSavedPrompts((prev) => prev.filter((e) => e.id !== id))
    } catch { /* non-critical */ }
  }, [])

  const handleRenameSavedPrompt = useCallback(async (id) => {
    const entry = savedPrompts.find((e) => e.id === id)
    if (!entry) return
    const newName = window.prompt('Rename to:', entry.name)
    if (!newName?.trim()) return
    try {
      const updated = await renameSavedPromptRemote(id, newName.trim())
      if (updated) setSavedPrompts((prev) => prev.map((e) => e.id === id ? { ...e, name: updated.name } : e))
    } catch { /* non-critical */ }
  }, [savedPrompts])

  const loadGallery = useCallback(async () => {
    setGalleryLoading(true)
    try {
      const result = await listGeneratedImages({ limit: 20 })
      setGalleryImages(result.items || [])
    } catch {
      setGalleryImages([])
    } finally {
      setGalleryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (showGallery) loadGallery()
  }, [showGallery, loadGallery])

  const comfyReady = comfyStatus?.available === true
  const isRenderBusy = renderState === 'queuing' || renderState === 'rendering'
  const mainRenderActive = activeRenderSlot === 'main' && (renderState === 'queuing' || renderState === 'rendering')
  const compareSlotBusy = (slot) => activeRenderSlot === slot && (renderState === 'queuing' || renderState === 'rendering')

  const queueRenderWithPrompt = useCallback(async (promptText, compareSlot = 'main') => {
    const positivePrompt = String(promptText ?? '').trim()
    if (!positivePrompt || !comfyReady || isRenderBusy) return
    setActiveRenderSlot(compareSlot)
    if (compareSlot === 'main') {
      setRenderError('')
      setRenderImages([])
      setShowRenderResults(true)
    } else {
      setCompareSlotError((prev) => ({ ...prev, [compareSlot]: '' }))
    }
    setRenderState('queuing')
    try {
      const queued = await queueBuilderPromptRender({
        positivePrompt,
        negativePrompt: NEGATIVE_PROMPT,
        aspectRatio: '2:3',
      })
      if (!queued?.promptId || !queued?.promptPackId) {
        throw new Error('Comfy queue did not return a prompt id')
      }
      setRenderJob({
        compareSlot,
        positivePrompt,
        promptId: queued.promptId,
        promptPackId: queued.promptPackId,
        characterId: queued.characterId,
        workflowVersion: queued.workflowId || queued.resolvedWorkflowId || null,
      })
      setRenderState('rendering')
    } catch (err) {
      setRenderState(compareSlot === 'main' ? 'failed' : 'idle')
      setActiveRenderSlot(null)
      const message = err?.message || 'Failed to queue ComfyUI render'
      if (compareSlot === 'main') {
        setRenderError(message)
      } else {
        setCompareSlotError((prev) => ({ ...prev, [compareSlot]: message }))
      }
    }
  }, [comfyReady, isRenderBusy])

  const handleRenderInComfy = useCallback(async () => {
    await queueRenderWithPrompt(displayText, 'main')
  }, [queueRenderWithPrompt, displayText])

  const renderSnapshot = useCallback(async (slot) => {
    const snapshot = slot === 'A' ? snapshotA : snapshotB
    await queueRenderWithPrompt(snapshot?.text || '', slot)
  }, [snapshotA, snapshotB, queueRenderWithPrompt])

  useEffect(() => {
    if (renderState !== 'rendering' || !renderJob?.promptId) return undefined
    let active = true
    const poll = async () => {
      try {
        const statusData = await getComfyJobsStatus([{
          promptId: renderJob.promptId,
          promptPackId: renderJob.promptPackId,
          view: 'cinematic_scene',
        }])
        const item = (statusData?.items || []).find((entry) => entry.promptId === renderJob.promptId)
        const status = item?.status || 'unknown'
        if (status === 'success') {
          // Ingest even if the component unmounted mid-poll so completed images are not lost.
          const ingested = await ingestComfyOutputs({
            promptId: renderJob.promptId,
            promptPackId: renderJob.promptPackId,
            characterId: renderJob.characterId,
            viewType: 'cinematic_scene',
            workflowVersion: renderJob.workflowVersion,
          })
          if (!active) return
          const items = (ingested?.items || []).map((image) => ({ id: image.id }))
          const slot = renderJob.compareSlot ?? 'main'
          if (slot === 'main') {
            setRenderImages(items)
            setRenderState('success')
            setActiveRenderSlot(null)
          } else {
            const snippet = String(renderJob.positivePrompt ?? '').trim().slice(0, 160)
            setLastCompareRender((prev) => ({
              ...prev,
              [slot]: {
                images: items,
                promptSnippet: snippet,
                timestamp: Date.now(),
              },
            }))
            setRenderState('idle')
            setRenderJob(null)
            setActiveRenderSlot(null)
          }
          if (items.length) loadGallery()
          return
        }
        if (!active) return
        // Only terminal Comfy failure stops polling. Transient status-check errors
        // (`ok: false` without status, or network throws) must keep polling — Casting does the same.
        if (status === 'failed') {
          const slot = renderJob.compareSlot ?? 'main'
          const msg = item?.error || 'ComfyUI render failed'
          if (slot === 'main') {
            setRenderState('failed')
            setRenderError(msg)
            setActiveRenderSlot(null)
          } else {
            setCompareSlotError((prev) => ({ ...prev, [slot]: msg }))
            setRenderState('idle')
            setRenderJob(null)
            setActiveRenderSlot(null)
          }
        }
      } catch {
        // Network / status-check blip — keep polling until Comfy reports success or failed.
      }
    }
    poll()
    renderPollRef.current = window.setInterval(poll, 2000)
    return () => {
      active = false
      if (renderPollRef.current) {
        window.clearInterval(renderPollRef.current)
        renderPollRef.current = null
      }
    }
  }, [loadGallery, renderJob, renderState])

  const handleValidateLmStudio = useCallback(async () => {
    if (!lmStudioBaseUrl) {
      setLmStudioValidation({ status: 'error', message: 'Set LM Studio host and port first.' })
      return
    }
    setLmStudioValidation({ status: 'loading', message: 'Checking LM Studio...' })
    try {
      const info = await checkHealth({
        engine: 'local',
        localOnly: true,
        localProvider: 'lmstudio',
        lmStudioBaseUrl,
        lmStudioModel,
      })
      if (info?.lmstudio?.available) {
        setLmStudioValidation({ status: 'ok', message: `LM Studio reachable at ${info.lmstudio.baseUrl}` })
      } else {
        setLmStudioValidation({ status: 'error', message: 'LM Studio not reachable. Check IP/port and LAN access.' })
      }
    } catch (err) {
      setLmStudioValidation({ status: 'error', message: err?.message || 'LM Studio validation failed.' })
    }
  }, [checkHealth, lmStudioBaseUrl, lmStudioModel])

  // Status badge
  const badge = hasManualEdit
    ? { label: 'manually edited', cls: styles.statusPolished }
    : hasVariantOverride
    ? { label: `variant: ${selectedVariant.label}`, cls: styles.statusPolished }
    : restoredText
    ? { label: 'restored', cls: styles.statusPolished }
    : isPolished
    ? { label: 'AI polished', cls: styles.statusPolished }
    : isAssembled
      ? { label: 'assembled', cls: styles.statusOk }
      : hasContent
        ? { label: 'chips only', cls: styles.statusRaw }
        : null

  const debugTheme = {
    panel: {
      marginTop: 14,
      marginBottom: 14,
      paddingTop: 12,
      paddingBottom: 12,
      borderTop: '1px solid rgba(148, 163, 184, 0.28)',
      borderBottom: '1px solid rgba(148, 163, 184, 0.28)',
    },
    headingRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    headingLeft: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
    },
    devBadge: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#1f2937',
      backgroundColor: 'rgba(148, 163, 184, 0.3)',
      border: '1px solid rgba(148, 163, 184, 0.55)',
      borderRadius: 999,
      padding: '2px 7px',
      lineHeight: 1.2,
    },
    section: {
      marginTop: 10,
      paddingTop: 8,
      borderTop: '1px solid rgba(148, 163, 184, 0.2)',
    },
    sectionTitle: {
      margin: '0 0 6px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.09em',
      textTransform: 'uppercase',
      opacity: 0.75,
    },
    row: {
      display: 'grid',
      gridTemplateColumns: '140px minmax(0, 1fr)',
      alignItems: 'start',
      columnGap: 12,
      margin: '3px 0',
      fontSize: 13,
    },
    label: {
      opacity: 0.72,
    },
    value: {
      minWidth: 0,
      overflowWrap: 'anywhere',
      whiteSpace: 'pre-wrap',
    },
    mutedValue: {
      opacity: 0.6,
    },
    warningValue: {
      color: '#d97706',
    },
    blockValue: {
      marginTop: 2,
      maxHeight: 160,
      overflow: 'auto',
      padding: '8px 10px',
      borderRadius: 8,
      border: '1px solid rgba(148, 163, 184, 0.35)',
      backgroundColor: 'rgba(15, 23, 42, 0.2)',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      lineHeight: 1.35,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    },
  }

  const isDebugValueMuted = (value) => (
    value === 'n/a'
    || value === 'none'
    || value === ''
    || value == null
  )

  const effectiveProviderLabel = useMemo(() => {
    const provider = debug?.lastResponse?.provider
    const lastRequest = debug?.lastRequest || {}
    if (!provider) return 'n/a'
    if (provider === 'cloud') {
      const cloudProvider = String(lastRequest.cloudProvider || '').toLowerCase()
      return cloudProvider ? `cloud/${cloudProvider}` : 'cloud/claude'
    }
    if (provider === 'local') {
      const localProviderName = String(lastRequest.localProvider || '').toLowerCase()
      return localProviderName ? `local/${localProviderName}` : 'local/ollama'
    }
    if (provider === 'embedded') return 'embedded/sidecar'
    return String(provider)
  }, [debug])

  return (
    <div className={styles.wrap}>
      {/* Header row */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerLabel}>Prompt</span>
          {badge && (
            <span className={`${styles.statusBadge} ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </div>
        <div className={styles.headerActions}>
          {isEditable && (
            <button
              type="button"
              className={styles.repolishBtn}
              onClick={isManualEditMode ? exitManualEditMode : enterManualEditMode}
              title={isManualEditMode ? 'Stop editing prompt text' : 'Edit the displayed prompt manually'}
            >
              {isManualEditMode ? 'Done editing' : 'Edit prompt'}
            </button>
          )}
          {hasManualEdit && (
            <button
              type="button"
              className={styles.repolishBtn}
              onClick={handleDiscardManualEdits}
              title="Discard manual edits and restore the AI/assembled text"
            >
              Discard edits
            </button>
          )}
          {hasManualEdit && (
            <button
              type="button"
              className={styles.resetBtn}
              onClick={handleResetToAssembled}
              title="Reset to assembled prompt from chips"
            >
              ↻ Reset
            </button>
          )}
          <button
            type="button"
            className={`${styles.copyBtn} ${shareState === 'copied' ? styles.copied : ''}`}
            onClick={handleShare}
            disabled={!hasContent}
            title="Copies a shareable URL with your full workspace encoded in the page fragment."
          >
            {shareState === 'copied' ? '✓ Link copied' : shareState === 'error' ? 'Failed' : 'Copy share link'}
          </button>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={handleExportTxt}
            disabled={!displayText.trim()}
            title="Download positive prompt plus NEGATIVE block as a .txt file."
          >
            Export .txt
          </button>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={handleSavePrompt}
            disabled={!displayText.trim()}
            title="Save this prompt under a name"
          >
            Save prompt
          </button>
          <CopyButton text={displayText} />
        </div>
      </div>

      <details className={styles.workflowHints}>
        <summary className={styles.workflowHintsSummary}>
          Workflow tips: edit prompt, polish, Comfy, A/B compare
        </summary>
        <ul className={styles.workflowHintsList}>
          <li>
            <strong>Edit prompt</strong> switches the big block to a textarea so you can tweak wording directly.
            <strong> Done editing</strong> returns to read-only. <strong>Discard edits</strong> drops manual text;
            <strong>Reset</strong> rebuilds from chips again.
          </li>
          <li>
            <strong>Polish with AI</strong> fuses chip fragments (and scene/director context) into one prompt.
            <strong> Polish current text</strong> sends whatever is on screen now (including your manual edits) back through the model for another pass — use that for human → AI → human loops.
          </li>
          <li>
            <strong>Render in ComfyUI</strong> always queues the <em>current displayed</em> prompt (manual text counts).
            One job runs at a time; the main button only shows progress for main renders.
          </li>
          <li>
            <strong>Save to A / B</strong> freezes two prompt variants. <strong>Render A / Render B</strong> queues each snapshot without overwriting the other column.
            <strong> Compare renders</strong> keeps the last successful image per slot side by side; it is restored after refresh in this tab (<code>sessionStorage</code> key <code>qpb_compare_renders_v1</code>).
            Use <strong>Clear</strong> per column or <strong>Clear all</strong> to wipe stored previews.
          </li>
          <li>
            <strong>Use A / B</strong> loads that snapshot into the editor as a manual edit so you can keep refining before polish or Comfy.
          </li>
        </ul>
      </details>

      {hasContent && (
        <div className={styles.qualityRow}>
          <button
            type="button"
            className={styles.qualitySummary}
            onClick={() => setShowQualityHints((v) => !v)}
            aria-expanded={showQualityHints}
          >
            <span className={styles.qualityLabel}>Quality</span>
            <span className={styles.qualityScore}>{qualityReport.overall}</span>
            <span className={styles.qualityHintToggle}>{showQualityHints ? 'Hide' : 'Details'}</span>
          </button>
          {showQualityHints && (
            <ul className={styles.qualityList}>
              {qualityReport.breakdown.map((row) => (
                <li key={row.key} className={styles.qualityItem}>
                  <span className={styles.qualityItemLabel}>{row.label}</span>
                  <span className={styles.qualityItemScore}>
                    {row.score}/{row.max}
                  </span>
                  {row.hint ? <span className={styles.qualityItemHint}>{row.hint}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {applyDiff?.changes?.length > 0 && (
        <div className={styles.applyDiffBox}>
          <div className={styles.applyDiffHeader}>
            <div className={styles.applyDiffHeaderLeft}>
              <span className={styles.applyDiffTitle}>Last apply changes</span>
              <span className={styles.applyDiffMeta}>
                {applyDiff.source} · {new Date(applyDiff.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className={styles.applyDiffActions}>
              <button
                type="button"
                className={`${styles.diffTinyBtn} ${isApplyDiffPinned ? styles.diffTinyBtnActive : ''}`}
                onClick={() => onPinApplyDiff?.(!isApplyDiffPinned)}
                title={isApplyDiffPinned ? 'Unpin diff (allow updates)' : 'Pin diff (freeze this snapshot)'}
              >
                {isApplyDiffPinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                type="button"
                className={styles.diffTinyBtn}
                onClick={() => onClearApplyDiff?.()}
                title="Clear apply diff panel"
              >
                Clear
              </button>
            </div>
          </div>
          <ul className={styles.applyDiffList}>
            {applyDiff.changes.map((change, idx) => (
              <li key={`${applyDiff.id}-${idx}`} className={styles.applyDiffItem}>
                {change.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Prompt display */}
      {isEditable && isManualEditMode ? (
        <textarea
          ref={textareaRef}
          className={`${styles.promptTextarea} ${isAssembled || isPolished ? styles.promptBoxActive : ''} ${hasManualEdit ? styles.promptBoxEdited : isPolished ? styles.promptBoxPolished : ''}`}
          value={displayText}
          onChange={handleTextareaChange}
          placeholder="Configure directors and characters, then add technical chips…"
          spellCheck={false}
        />
      ) : (
        <div className={`${styles.promptBox} ${isAssembled || isPolished ? styles.promptBoxActive : ''} ${isPolished ? styles.promptBoxPolished : ''}`}>
          {isEditable ? (
            <p className={styles.promptParts}>{displayText}</p>
          ) : (
            <p className={styles.placeholder}>
              Configure directors and characters, then add technical chips…
            </p>
          )}
        </div>
      )}

      {hasManualEdit && (
        <p className={styles.engineHint}>
          Manual edit active — chip-derived rules are not reflected in this text.{' '}
          <button type="button" className={styles.ruleFixBtn} onClick={handleResetToAssembled}>
            Reset to assembled
          </button>
        </p>
      )}

      {!hasManualEdit && issues.length > 0 && (
        <div className={styles.rulePanel}>
          {issues.map((issue) => (
            <div key={issue.id} className={styles.ruleItem}>
              <span className={styles.ruleText}>{issue.message}</span>
              <button
                className={styles.ruleFixBtn}
                onClick={() => onApplyRuleFix?.(issue.id)}
              >
                {issue.fixLabel}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.renderWrap}>
        <div className={styles.renderRow}>
          <button
            type="button"
            className={`${styles.renderBtn} ${mainRenderActive ? styles.renderBtnLoading : ''}`}
            onClick={handleRenderInComfy}
            disabled={!displayText.trim() || !comfyReady || isRenderBusy}
            title={comfyReady ? 'Queue this prompt in ComfyUI' : (comfyError || 'ComfyUI is not reachable')}
          >
            {renderState === 'queuing' && activeRenderSlot === 'main' ? (
              <>
                <span className={styles.spinner} />
                Queuing…
              </>
            ) : renderState === 'rendering' && activeRenderSlot === 'main' ? (
              <>
                <span className={styles.spinner} />
                Rendering…
              </>
            ) : (
              'Render in ComfyUI'
            )}
          </button>
          {(renderImages.length > 0
            || (renderState === 'rendering' && activeRenderSlot === 'main')
            || (renderState === 'failed' && renderError)) && (
            <button
              type="button"
              className={styles.revertBtn}
              onClick={() => setShowRenderResults((value) => !value)}
            >
              {showRenderResults ? 'Hide render results' : 'Show render results'}
            </button>
          )}
        </div>
        {!comfyReady && (
          <p className={styles.renderHint}>
            {comfyError || 'Start ComfyUI on localhost:8188 to render from the prompt builder.'}
          </p>
        )}
        <p className={styles.renderHint}>
          Render always uses the current on-screen prompt text, including manual edits.
        </p>
        {renderError && (
          <p className={styles.renderError}>{renderError}</p>
        )}
        {showRenderResults && (renderState === 'rendering' && activeRenderSlot === 'main' || renderImages.length > 0) && (
          <div className={styles.renderPanel}>
            {renderState === 'rendering' && activeRenderSlot === 'main' && renderImages.length === 0 && (
              <p className={styles.renderStatus}>Waiting for ComfyUI to finish this render…</p>
            )}
            {renderImages.length > 0 && (
              <div className={styles.renderGrid}>
                {renderImages.map((image) => (
                  <a
                    key={image.id}
                    href={`/api/generated-image-view?id=${image.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.renderItem}
                  >
                    <img
                      src={`/api/generated-image-view?id=${image.id}`}
                      alt="Prompt builder render"
                      className={styles.renderThumb}
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {state === 'error' && error && (
        <div className={styles.errorMsg}>
          ✕ {error}
        </div>
      )}

      <div className={styles.prefixRow}>
        <label className={styles.prefixToggle}>
          <span>Local provider:</span>
          <select
            value={localProvider}
            onChange={(e) => setLocalProvider(e.target.value)}
            disabled={state === 'loading'}
            style={{ marginLeft: 8 }}
          >
            <option value="ollama">Ollama</option>
            <option value="lmstudio">LM Studio</option>
            <option value="mock">Mock</option>
          </select>
        </label>
      </div>

      {localProvider === 'lmstudio' && (
        <>
          <div className={styles.prefixRow}>
            <label className={styles.prefixToggle}>
              <span>LM Studio host:</span>
              <input
                value={lmStudioHost}
                onChange={(e) => setLmStudioHost(e.target.value)}
                placeholder="192.168.1.50"
                disabled={state === 'loading'}
                style={{ marginLeft: 8 }}
              />
            </label>
            <label className={styles.prefixToggle}>
              <span>Port:</span>
              <input
                value={lmStudioPort}
                onChange={(e) => setLmStudioPort(e.target.value)}
                placeholder="1234"
                disabled={state === 'loading'}
                style={{ marginLeft: 8, width: 80 }}
              />
            </label>
            <label className={styles.prefixToggle}>
              <span>Model:</span>
              <input
                value={lmStudioModel}
                onChange={(e) => setLmStudioModel(e.target.value)}
                placeholder="qwen-local"
                disabled={state === 'loading'}
                style={{ marginLeft: 8 }}
              />
            </label>
            <button
              className={styles.revertBtn}
              onClick={handleValidateLmStudio}
              disabled={lmStudioValidation.status === 'loading'}
            >
              {lmStudioValidation.status === 'loading' ? 'Validating...' : 'Validate LM Studio'}
            </button>
          </div>
          <p className={styles.engineHint}>
            LM Studio URL: {lmStudioBaseUrl || '(set host and port)'}
          </p>
          {lmStudioValidation.message && (
            <p className={styles.engineHint}>
              {lmStudioValidation.status === 'ok' ? 'Connected: ' : 'Validation: '}
              {lmStudioValidation.message}
            </p>
          )}
        </>
      )}

      {healthError ? (
        <p className={styles.engineHint}>Engine check failed: {healthError}</p>
      ) : (
        <p className={styles.engineHint}>
          {health?.provider === 'local'
            ? health?.local?.provider === 'lmstudio'
              ? health?.local?.available
                ? `Using LM Studio at ${health?.local?.baseUrl || 'configured URL'}.`
                : 'LM Studio unavailable at configured URL. Check host/port and LAN reachability.'
              : health?.local?.installed
                ? 'Using local Ollama model.'
                : 'Ollama is running, but model missing. Run: ollama pull qwen2.5:7b-instruct'
            : health?.provider === 'embedded'
              ? health?.embedded?.ready
                ? 'Using embedded sidecar model.'
                : 'Embedded model loading...'
            : health?.fallback && !localOnly
              ? 'Local unavailable; automatically falling back to cloud.'
              : localOnly
                ? 'Local-only mode active. Cloud fallback disabled.'
              : 'Using cloud provider (Claude API).'}
        </p>
      )}
      <p className={styles.engineHint}>
        Effective provider (last request): {effectiveProviderLabel}
      </p>

      {isDev && (
        <div className={styles.debugPanel} style={debugTheme.panel}>
          <div className={styles.header} style={debugTheme.headingRow}>
            <div style={debugTheme.headingLeft}>
              <p className={styles.debugTitle}>Developer debug panel</p>
              <span style={debugTheme.devBadge}>DEV</span>
            </div>
            <button
              type="button"
              className={`${styles.copyBtn} ${debugCopyState === 'copied' ? styles.copied : ''}`}
              onClick={handleCopyDebugJson}
            >
              {debugCopyState === 'copied' ? '✓ Copied' : debugCopyState === 'error' ? 'Failed' : 'Copy debug JSON'}
            </button>
          </div>
          {state === 'dry-run' && (
            <p className={styles.errorMsg}>DRY RUN MODE ACTIVE</p>
          )}
          <div style={debugTheme.section}>
            <p style={debugTheme.sectionTitle}>Request</p>
            <p className={styles.debugRow} style={debugTheme.row}>
              <span style={debugTheme.label}>Request state</span>
              <span style={debugTheme.value}>{state}</span>
            </p>
            <p className={styles.debugRow} style={debugTheme.row}>
              <span style={debugTheme.label}>Dry run</span>
              <span style={debugTheme.value}>{String(dryRun)}</span>
            </p>
            <p className={styles.debugRow} style={debugTheme.row}>
              <span style={debugTheme.label}>Selected engine</span>
              <span style={debugTheme.value}>{debug?.lastRequest?.engine ?? aiEngine}</span>
            </p>
            <p className={styles.debugRow} style={debugTheme.row}>
              <span style={debugTheme.label}>localOnly</span>
              <span style={debugTheme.value}>{String(debug?.lastRequest?.localOnly ?? localOnly)}</span>
            </p>
          </div>

          <div style={debugTheme.section}>
            <p style={debugTheme.sectionTitle}>Response</p>
            <p className={styles.debugRow} style={debugTheme.row}>
              <span style={debugTheme.label}>Provider</span>
              <span
                style={{
                  ...debugTheme.value,
                  ...(isDebugValueMuted(debug?.lastResponse?.provider ?? 'n/a') ? debugTheme.mutedValue : null),
                }}
              >
                {debug?.lastResponse?.provider ?? 'n/a'}
              </span>
            </p>
            <p className={styles.debugRow} style={debugTheme.row}>
              <span style={debugTheme.label}>Fallback</span>
              <span
                style={{
                  ...debugTheme.value,
                  ...(isDebugValueMuted(debug?.lastResponse?.fallback == null ? 'n/a' : String(debug.lastResponse.fallback)) ? debugTheme.mutedValue : null),
                }}
              >
                {debug?.lastResponse?.fallback == null ? 'n/a' : String(debug.lastResponse.fallback)}
              </span>
            </p>
          </div>

          <div style={debugTheme.section}>
            <p style={debugTheme.sectionTitle}>Diagnostics</p>
            <p className={styles.debugRow} style={debugTheme.row}>
              <span style={debugTheme.label}>Last error</span>
              <span
                style={{
                  ...debugTheme.value,
                  ...((debug?.lastError ?? error ?? 'none') === 'none'
                    ? debugTheme.mutedValue
                    : debugTheme.warningValue),
                }}
              >
                {debug?.lastError ?? error ?? 'none'}
              </span>
            </p>
            <p className={styles.debugRow} style={debugTheme.row}>
              <span style={debugTheme.label}>Assembled prompt</span>
              <pre
                className={styles.debugPre}
                style={{
                  ...debugTheme.blockValue,
                  ...(isDebugValueMuted(assembledText) ? debugTheme.mutedValue : null),
                }}
              >
                {assembledText || '(empty)'}
              </pre>
            </p>
            <p className={styles.debugRow} style={debugTheme.row}>
              <span style={debugTheme.label}>Payload preview</span>
              <pre className={styles.debugPre} style={debugTheme.blockValue}>
                {debug?.lastRequest ? JSON.stringify(debug.lastRequest, null, 2) : '(no payload yet)'}
              </pre>
            </p>
          </div>
        </div>
      )}

      {/* Polish / Revert buttons */}
      <div className={styles.prefixRow}>
        {isDev && (
          <label className={styles.prefixToggle}>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={state === 'loading'}
            />
            <span>Dry Run (no API call)</span>
          </label>
        )}
        <label className={styles.prefixToggle}>
          <input
            type="checkbox"
            checked={useFrontPrefix}
            onChange={(e) => setUseFrontPrefix(e.target.checked)}
            disabled={state === 'loading'}
          />
          <span>Use film-still prefix</span>
        </label>
        <code className={styles.prefixValue}>{DEFAULT_FRONT_PREFIX}</code>
      </div>

      {narrativeBeat?.trim() && (
        <p className={styles.narrativeHint}>
          Narrative beat active for polish — API distills it to one static instant (no dialogue in output).
        </p>
      )}

      <div className={styles.polishRow}>
        {isPolished ? (
          <button className={styles.revertBtn} onClick={revert}>
            ↩ Revert to assembled
          </button>
        ) : (
          <button
            className={`${styles.polishBtn} ${state === 'loading' ? styles.polishLoading : ''}`}
            onClick={handlePolish}
            disabled={!hasContent || state === 'loading'}
          >
            {state === 'loading' ? (
              <>
                <span className={styles.spinner} />
                Polishing…
              </>
            ) : (
              dryRun ? '✦ Dry run polish payload' : '✦ Polish with AI'
            )}
          </button>
        )}
        <button
          className={styles.repolishBtn}
          onClick={handlePolishCurrentText}
          disabled={!displayText.trim() || state === 'loading'}
          title="Refine the currently displayed prompt text through AI (manual, restored, variant, or polished)"
        >
          {state === 'loading' ? 'Polishing…' : 'Polish current text'}
        </button>
        {isPolished && (
          <button
            className={styles.repolishBtn}
            onClick={handlePolish}
            disabled={state === 'loading'}
          >
            {state === 'loading' ? 'Polishing…' : 'Re-polish'}
          </button>
        )}
      </div>

      <div className={styles.variantRow}>
        <button className={styles.repolishBtn} onClick={() => saveSnapshot('A')} disabled={!displayText.trim()}>
          Save to A
        </button>
        <button className={styles.repolishBtn} onClick={() => saveSnapshot('B')} disabled={!displayText.trim()}>
          Save to B
        </button>
        <button className={styles.repolishBtn} onClick={() => loadSnapshot('A')} disabled={!snapshotA?.text}>
          Use A
        </button>
        <button className={styles.repolishBtn} onClick={() => loadSnapshot('B')} disabled={!snapshotB?.text}>
          Use B
        </button>
        <button
          className={styles.repolishBtn}
          onClick={() => renderSnapshot('A')}
          disabled={!snapshotA?.text || !comfyReady || isRenderBusy}
        >
          {compareSlotBusy('A') ? (
            <>
              <span className={styles.spinner} />
              {' '}
              Rendering…
            </>
          ) : (
            'Render A'
          )}
        </button>
        <button
          className={styles.repolishBtn}
          onClick={() => renderSnapshot('B')}
          disabled={!snapshotB?.text || !comfyReady || isRenderBusy}
        >
          {compareSlotBusy('B') ? (
            <>
              <span className={styles.spinner} />
              {' '}
              Rendering…
            </>
          ) : (
            'Render B'
          )}
        </button>
      </div>
      {(snapshotA || snapshotB) && (
        <p className={styles.engineHint}>
          Snapshots:
          {snapshotA ? ` A (${snapshotA.source}, ${new Date(snapshotA.timestamp).toLocaleTimeString()})` : ' A (empty)'}
          {' | '}
          {snapshotB ? `B (${snapshotB.source}, ${new Date(snapshotB.timestamp).toLocaleTimeString()})` : 'B (empty)'}
        </p>
      )}

      {(snapshotA || snapshotB || lastCompareRender.A || lastCompareRender.B || compareSlotError.A || compareSlotError.B) && (
        <div className={styles.compareWrap}>
          <div className={styles.compareWrapHeader}>
            <p className={styles.compareWrapTitle}>Compare renders (last A vs last B)</p>
            {(lastCompareRender.A || lastCompareRender.B) && (
              <button
                type="button"
                className={styles.diffTinyBtn}
                onClick={clearAllCompareRenders}
                title="Remove stored A/B render previews from this tab"
              >
                Clear all
              </button>
            )}
          </div>
          <div className={styles.compareRow}>
            {['A', 'B'].map((slot) => {
              const data = lastCompareRender[slot]
              const err = compareSlotError[slot]
              const busy = compareSlotBusy(slot)
              return (
                <div key={slot} className={styles.compareCell}>
                  <div className={styles.compareCellHeader}>
                    <span className={styles.compareCellTitle}>Snapshot {slot}</span>
                    <span className={styles.compareCellHeaderRight}>
                      {busy ? <span className={styles.spinner} aria-hidden /> : null}
                      <button
                        type="button"
                        className={styles.diffTinyBtn}
                        onClick={() => clearCompareSlot(slot)}
                        disabled={busy || (!data && !err)}
                        title={`Clear ${slot} compare memory and errors`}
                      >
                        Clear
                      </button>
                    </span>
                  </div>
                  {err ? <p className={styles.renderError}>{err}</p> : null}
                  {data?.timestamp ? (
                    <p className={styles.compareMeta}>{new Date(data.timestamp).toLocaleString()}</p>
                  ) : null}
                  {data?.promptSnippet ? (
                    <p className={styles.compareSnippet} title={data.promptSnippet}>{data.promptSnippet}</p>
                  ) : null}
                  {data?.images?.length > 0 ? (
                    <div className={styles.compareThumbGrid}>
                      {data.images.map((image) => (
                        <a
                          key={image.id}
                          href={`/api/generated-image-view?id=${image.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.renderItem}
                        >
                          <img
                            src={`/api/generated-image-view?id=${image.id}`}
                            alt={`Compare render ${slot}`}
                            className={styles.renderThumb}
                            loading="lazy"
                          />
                        </a>
                      ))}
                    </div>
                  ) : !busy && !err ? (
                    <p className={styles.compareEmpty}>No render yet for {slot}. Use Render {slot}.</p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className={styles.variantRow}>
        <button
          className={styles.revertBtn}
          onClick={() => setShowVariants((v) => !v)}
          disabled={!hasContent}
        >
          {showVariants ? 'Hide variants' : 'Generate variants'}
        </button>
        {selectedVariant && (
          <button className={styles.repolishBtn} onClick={() => setSelectedVariant(null)}>
            Clear variant
          </button>
        )}
        {restoredText && (
          <button className={styles.repolishBtn} onClick={() => setRestoredText(null)}>
            Clear restore
          </button>
        )}
      </div>
      {showVariants && variants.length > 0 && (
        <div className={styles.variantList}>
          {variants.map((variant) => (
            <button
              key={variant.id}
              className={styles.variantCard}
              onClick={() => setSelectedVariant(variant)}
            >
              <span className={styles.variantTitle}>{variant.label}</span>
              <span className={styles.variantText}>{variant.text}</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.historyWrap}>
        <button
          className={styles.revertBtn}
          onClick={() => setShowHistory((v) => !v)}
          disabled={history.length === 0}
        >
          {showHistory ? 'Hide history' : `Prompt history (${history.length})`}
        </button>
        {showHistory && (
          <div className={styles.historyList}>
            {history.map((entry) => (
              <div key={entry.id} className={styles.historyItem}>
                <div className={styles.historyMeta}>
                  <span>{entry.kind}</span>
                  <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className={styles.historyText}>{entry.text}</p>
                <div className={styles.historyActions}>
                  <button className={styles.ruleFixBtn} onClick={() => setDiffTargetId(entry.id)}>
                    Diff
                  </button>
                  <button
                    className={styles.ruleFixBtn}
                    onClick={() => {
                      setRestoredText(entry.text)
                      setSelectedVariant(null)
                    }}
                  >
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.savedWrap}>
        <button
          className={styles.revertBtn}
          onClick={() => setShowSaved((v) => !v)}
          disabled={savedPrompts.length === 0}
        >
          {showSaved ? 'Hide saved' : `Saved prompts (${savedPrompts.length})`}
        </button>
        {showSaved && (
          <div className={styles.savedList}>
            {savedPrompts.map((entry) => (
              <div key={entry.id} className={styles.savedItem}>
                <div className={styles.savedMeta}>
                  <span className={styles.savedName}>{entry.name}</span>
                  <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                </div>
                <p className={styles.historyText}>{entry.text}</p>
                <div className={styles.historyActions}>
                  <CopyButton text={entry.text} label="Copy" />
                  <button
                    className={styles.ruleFixBtn}
                    onClick={() => {
                      setRestoredText(entry.text)
                      setSelectedVariant(null)
                    }}
                  >
                    Restore
                  </button>
                  <button
                    className={styles.ruleFixBtn}
                    onClick={() => handleRenameSavedPrompt(entry.id)}
                  >
                    Rename
                  </button>
                  <button
                    className={styles.ruleFixBtn}
                    onClick={() => handleDeleteSavedPrompt(entry.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.galleryWrap}>
        <div className={styles.galleryToggleRow}>
          <button
            className={styles.revertBtn}
            onClick={() => setShowGallery((v) => !v)}
          >
            {showGallery ? 'Hide images' : `Generated images${galleryImages.length > 0 ? ` (${galleryImages.length})` : ''}`}
          </button>
          {showGallery && (
            <button
              className={styles.ruleFixBtn}
              onClick={loadGallery}
              disabled={galleryLoading}
            >
              ↻ Refresh
            </button>
          )}
        </div>
        {showGallery && (
          <div className={styles.galleryPanel}>
            {galleryLoading && (
              <p className={styles.galleryEmpty}>Loading…</p>
            )}
            {!galleryLoading && galleryImages.length === 0 && (
              <p className={styles.galleryEmpty}>No generated images yet. Render from the prompt above or run the casting pipeline.</p>
            )}
            {!galleryLoading && galleryImages.length > 0 && (
              <div className={styles.galleryGrid}>
                {galleryImages.map((img) => (
                  <a
                    key={img.id}
                    href={`/api/generated-image-view?id=${img.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.galleryItem}
                    title={[img.viewType, img.characterId].filter(Boolean).join(' · ')}
                  >
                    <img
                      src={`/api/generated-image-view?id=${img.id}`}
                      alt={img.viewType || 'generated'}
                      className={styles.galleryThumb}
                      loading="lazy"
                    />
                    {img.viewType && (
                      <span className={styles.galleryCaption}>
                        {img.viewType.replace(/_/g, ' ')}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {diffData && (
        <div className={styles.diffBox}>
          <p className={styles.tipsTitle}>Diff vs current output</p>
          <p className={styles.diffRemoved}>Removed: {diffData.removed.join(' ') || '—'}</p>
          <p className={styles.diffAdded}>Added: {diffData.added.join(' ') || '—'}</p>
        </div>
      )}

      {/* Aspect ratio reminder */}
      {hasContent && (
        <div className={styles.arReminder}>
          <span className={styles.arLabel}>Append →</span>
          <code className={styles.arCode}>--ar 2.35:1</code>
          <span className={styles.arOr}>or</span>
          <code className={styles.arCode}>--ar 16:9</code>
        </div>
      )}

      {/* Negative prompt */}
      <div className={styles.negSection}>
        <div className={styles.negHeader}>
          <button
            className={styles.negToggle}
            onClick={() => setShowNeg(o => !o)}
          >
            <span className={`${styles.chevron} ${showNeg ? styles.chevronOpen : ''}`}>›</span>
            <span>Negative prompt</span>
          </button>
          <CopyButton text={NEGATIVE_PROMPT} label="Copy neg" />
        </div>
        {showNeg && (
          <div className={styles.negBox}>
            {NEGATIVE_PROMPT}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className={styles.tips}>
        <p className={styles.tipsTitle}>How to use</p>
        <ul className={styles.tipsList}>
          <li>Pick a director → set characters → choose a scenario</li>
          <li>Add environment, light, palette, and film chips</li>
          <li>Describe your scene in the field above (optional)</li>
          <li>Hit <strong>Polish with AI</strong> to fuse fragments into a unified prompt, or <strong>Polish current text</strong> to refine what you already see</li>
          <li>Use <strong>Edit prompt</strong> for manual tweaks; <strong>Render in ComfyUI</strong> for a quick visual check of the current text</li>
          <li>Optional: <strong>Save to A/B</strong> and <strong>Render A/B</strong> to compare two prompt variants side by side</li>
          <li>Copy and paste into Qwen — append aspect ratio</li>
        </ul>
      </div>
    </div>
  )
}
