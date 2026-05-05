import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { fetchWorkspaceProfiles, upsertWorkspaceProfileRemote, deleteWorkspaceProfileRemote } from './api/promptStorage.js'
import { assemblePrompt } from './utils/assembler.js'
import { PRESETS, DIRECTOR_PRESETS } from './data/constants.js'
import { DIRECTORS } from './data/directors.js'
import { getSceneBankEntry } from './data/sceneBank.js'
import { validatePromptRules, applyRuleFix } from './utils/promptRules.js'
import { generatePromptVariants } from './utils/variants.js'
import { useWorkspaceHistory } from './hooks/useWorkspaceHistory.js'
import Header from './components/Header.jsx'
import SceneInput from './components/SceneInput.jsx'
import SceneScaffold from './components/SceneScaffold.jsx'
import SceneDeck from './components/SceneDeck.jsx'
import SceneMatcher from './components/SceneMatcher.jsx'
import DirectorSection from './components/DirectorSection.jsx'
import ChipSection from './components/ChipSection.jsx'
import PromptOutput from './components/PromptOutput.jsx'
import ReferenceBoard from './components/ReferenceBoard.jsx'
import CommandPalette from './components/CommandPalette.jsx'
import BatchExplorer from './components/BatchExplorer.jsx'
import EmbeddedSetup from './components/EmbeddedSetup.jsx'
import CharacterBuilder from './components/CharacterBuilder.jsx'
import CastingPipelinePanel from './components/CastingPipelinePanel.jsx'
import ActorBankView from './components/ActorBank/ActorBankView.jsx'
import MobilePromptBar from './components/MobilePromptBar.jsx'
import styles from './App.module.css'

const DEFAULT_CHARS = [
  { g: 'man', a: '40s' },
  { g: 'woman', a: '30s' },
  { g: 'man', a: '20s' },
]
const CUSTOM_PRESETS_KEY = 'qpb_custom_presets_v1'
const CUSTOM_DIRECTORS_KEY = 'qpb_custom_directors_v1'
const WORKSPACE_PROFILES_KEY = 'qpb_workspace_profiles_v1' // kept for one-time migration only
const AI_ENGINE_KEY = 'qpb_ai_engine_v1'
const LOCAL_ONLY_KEY = 'qpb_local_only_v1'
const CHARACTERS_KEY = 'qpb_characters_v1'

function encodeShareState(state) {
  const json = JSON.stringify(state)
  return btoa(unescape(encodeURIComponent(json)))
}

function decodeShareState(raw) {
  try {
    const json = decodeURIComponent(escape(atob(raw)))
    return JSON.parse(json)
  } catch {
    return null
  }
}

function readCustomPresets() {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function readCustomDirectors() {
  try {
    const raw = localStorage.getItem(CUSTOM_DIRECTORS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}



function readAiEngine() {
  try {
    const raw = localStorage.getItem(AI_ENGINE_KEY)
    return raw === 'auto' || raw === 'local' || raw === 'cloud' || raw === 'embedded' ? raw : 'auto'
  } catch {
    return 'auto'
  }
}

function readLocalOnly() {
  try {
    return localStorage.getItem(LOCAL_ONLY_KEY) === '1'
  } catch {
    return false
  }
}

function readCharacters() {
  try {
    const raw = localStorage.getItem(CHARACTERS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function normalizeChipMap(map) {
  if (!map || typeof map !== 'object') return {}
  return Object.fromEntries(
    Object.entries(map)
      .filter(([, values]) => Array.isArray(values))
      .map(([key, values]) => [key, [...values].sort()])
      .sort(([a], [b]) => a.localeCompare(b))
  )
}

function summarizeApplyDiff(before, after, source) {
  if (!before || !after) return null
  const changes = []

  const beforeScene = (before.scene ?? '').trim()
  const afterScene = (after.scene ?? '').trim()
  if (beforeScene !== afterScene) {
    if (afterScene.startsWith(beforeScene) && afterScene.length > beforeScene.length) {
      const appended = afterScene.slice(beforeScene.length).replace(/^[,\s]+/, '').trim()
      changes.push({
        kind: 'scene',
        text: appended ? `Scene appended: "${appended}"` : 'Scene text updated',
      })
    } else {
      changes.push({ kind: 'scene', text: 'Scene text replaced/edited' })
    }
  }

  if ((before.selectedDir ?? null) !== (after.selectedDir ?? null)) {
    const beforeLabel = before.selectedDir ? (DIRECTORS[before.selectedDir]?.short ?? before.selectedDir) : 'none'
    const afterLabel = after.selectedDir ? (DIRECTORS[after.selectedDir]?.short ?? after.selectedDir) : 'none'
    changes.push({ kind: 'director', text: `Director: ${beforeLabel} -> ${afterLabel}` })
  }

  if ((before.narrativeBeat ?? null) !== (after.narrativeBeat ?? null)) {
    changes.push({ kind: 'beat', text: after.narrativeBeat ? 'Narrative beat set/updated' : 'Narrative beat cleared' })
  }

  const b = normalizeChipMap(before.chips)
  const a = normalizeChipMap(after.chips)
  const groups = new Set([...Object.keys(b), ...Object.keys(a)])
  const chipAdded = []
  const chipRemoved = []
  const chipChanged = []
  for (const groupId of groups) {
    const bv = b[groupId] ?? []
    const av = a[groupId] ?? []
    if (JSON.stringify(bv) === JSON.stringify(av)) continue
    if (bv.length === 0 && av.length > 0) chipAdded.push(groupId)
    else if (bv.length > 0 && av.length === 0) chipRemoved.push(groupId)
    else chipChanged.push(groupId)
  }
  if (chipAdded.length || chipRemoved.length || chipChanged.length) {
    const bits = []
    if (chipAdded.length) bits.push(`added ${chipAdded.join(', ')}`)
    if (chipRemoved.length) bits.push(`removed ${chipRemoved.join(', ')}`)
    if (chipChanged.length) bits.push(`changed ${chipChanged.join(', ')}`)
    changes.push({ kind: 'chips', text: `Chips: ${bits.join(' · ')}` })
  }

  if (changes.length === 0) return null
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    source,
    timestamp: Date.now(),
    changes,
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('builder')
  const [scene, setScene] = useState('')
  const [selectedDir, setSelectedDir] = useState(null)
  const [charCount, setCharCount] = useState(1)
  const [chars, setChars] = useState(DEFAULT_CHARS)
  const [scenario, setScenario] = useState(null)
  const [chips, setChips] = useState({})
  const [lastAppliedPresetLabel, setLastAppliedPresetLabel] = useState(null)
  const [blendEnabled, setBlendEnabled] = useState(false)
  const [blendDir, setBlendDir] = useState(null)
  const [blendWeight, setBlendWeight] = useState(70)
  const [customPresets, setCustomPresets] = useState(() => readCustomPresets())
  const [customDirectors, setCustomDirectors] = useState(() => readCustomDirectors())
  const [profiles, setProfiles] = useState({})
  const [selectedProfile, setSelectedProfile] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [narrativeBeat, setNarrativeBeat] = useState(null)
  const [useStyleKeyForPolish, setUseStyleKeyForPolish] = useState(false)
  const [applyDiff, setApplyDiff] = useState(null)
  const [isApplyDiffPinned, setIsApplyDiffPinned] = useState(false)
  const [pendingApply, setPendingApply] = useState(null)
  const [aiEngine, setAiEngine] = useState(() => readAiEngine())
  const [localOnly, setLocalOnly] = useState(() => readLocalOnly())
  const [embeddedSetupOpen, setEmbeddedSetupOpen] = useState(false)
  const [embeddedStatus, setEmbeddedStatus] = useState(null)
  const [characters, setCharacters] = useState(() => readCharacters())
  const promptExportRef = useRef(null)
  const matcherRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(customPresets))
  }, [customPresets])

  useEffect(() => {
    localStorage.setItem(CUSTOM_DIRECTORS_KEY, JSON.stringify(customDirectors))
  }, [customDirectors])

  // Load workspace profiles from DB on mount; migrate legacy localStorage entries once.
  useEffect(() => {
    let active = true
    fetchWorkspaceProfiles().then((items) => {
      if (!active) return
      if (items.length === 0) {
        try {
          const raw = localStorage.getItem(WORKSPACE_PROFILES_KEY)
          const legacy = raw ? JSON.parse(raw) : null
          if (legacy && typeof legacy === 'object' && Object.keys(legacy).length) {
            const entries = Object.entries(legacy)
            Promise.all(entries.map(([id, p]) => upsertWorkspaceProfileRemote({ id, label: p.label, state: p.state }).catch(() => null)))
              .then(() => fetchWorkspaceProfiles())
              .then((migrated) => {
                if (!active) return
                const obj = {}
                for (const p of migrated) obj[p.id] = { label: p.label, state: p.state }
                setProfiles(obj)
                localStorage.removeItem(WORKSPACE_PROFILES_KEY)
              })
            return
          }
        } catch { /* ignore */ }
      }
      const obj = {}
      for (const p of items) obj[p.id] = { label: p.label, state: p.state }
      setProfiles(obj)
    }).catch(() => { /* API unavailable — leave empty */ })
    return () => { active = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem(AI_ENGINE_KEY, aiEngine)
  }, [aiEngine])

  useEffect(() => {
    localStorage.setItem(LOCAL_ONLY_KEY, localOnly ? '1' : '0')
  }, [localOnly])

  useEffect(() => {
    localStorage.setItem(CHARACTERS_KEY, JSON.stringify(characters))
  }, [characters])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.__qpb = window.__qpb || {}
    window.__qpb.embedded = {
      port: embeddedStatus?.port ?? null,
      secret: embeddedStatus?.secret ?? null,
      running: Boolean(embeddedStatus?.running),
    }
  }, [embeddedStatus])

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith('#state=')) return
    const decoded = decodeShareState(hash.slice('#state='.length))
    if (!decoded || typeof decoded !== 'object') return

    if (typeof decoded.scene === 'string') setScene(decoded.scene)
    if (typeof decoded.dirKey === 'string' || decoded.dirKey === null) {
      setSelectedDir(decoded.dirKey && DIRECTORS[decoded.dirKey] ? decoded.dirKey : null)
    }
    if ([1, 2, 3].includes(decoded.charCount)) setCharCount(decoded.charCount)
    if (Array.isArray(decoded.chars) && decoded.chars.length > 0) {
      const normalized = DEFAULT_CHARS.map((base, i) => ({
        g: decoded.chars[i]?.g ?? base.g,
        a: decoded.chars[i]?.a ?? base.a,
      }))
      setChars(normalized)
    }
    if (typeof decoded.scenario === 'string' || decoded.scenario === null) {
      setScenario(decoded.scenario)
    }
    if (decoded.chips && typeof decoded.chips === 'object') {
      const safeChips = Object.fromEntries(
        Object.entries(decoded.chips)
          .filter(([, v]) => Array.isArray(v))
          .map(([k, v]) => [k, v.filter((item) => typeof item === 'string')])
      )
      setChips(safeChips)
    }
    if (typeof decoded.blendEnabled === 'boolean') setBlendEnabled(decoded.blendEnabled)
    if (typeof decoded.blendDir === 'string' || decoded.blendDir === null) {
      setBlendDir(decoded.blendDir && DIRECTORS[decoded.blendDir] ? decoded.blendDir : null)
    }
    if (typeof decoded.blendWeight === 'number') {
      const clamped = Math.min(90, Math.max(50, decoded.blendWeight))
      setBlendWeight(clamped)
    }
    if (typeof decoded.narrativeBeat === 'string' || decoded.narrativeBeat === null) {
      setNarrativeBeat(decoded.narrativeBeat ?? null)
    }
    if (typeof decoded.useStyleKeyForPolish === 'boolean') {
      setUseStyleKeyForPolish(decoded.useStyleKeyForPolish)
    }
    if (decoded.aiEngine === 'auto' || decoded.aiEngine === 'local' || decoded.aiEngine === 'cloud' || decoded.aiEngine === 'embedded') {
      setAiEngine(decoded.aiEngine)
    }
    if (typeof decoded.localOnly === 'boolean') {
      setLocalOnly(decoded.localOnly)
    }
  }, [])

  const polishDirectorNote = useMemo(() => {
    if (!selectedDir) return null
    const bank = getSceneBankEntry(selectedDir)
    if (useStyleKeyForPolish && bank?.styleKey) return bank.styleKey
    return DIRECTORS[selectedDir]?.note ?? null
  }, [selectedDir, useStyleKeyForPolish])

  const exportFilenameBase = useMemo(() => {
    const short = selectedDir ? DIRECTORS[selectedDir]?.short : null
    if (short && String(short).trim()) {
      return `qpb-${String(short).replace(/\s+/g, '-')}`.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
    }
    return 'qpb-prompt'
  }, [selectedDir])

  const prompt = useMemo(
    () => assemblePrompt({ scene, scenario, chips, characters }),
    [scene, scenario, chips, characters]
  )
  const variants = useMemo(() => generatePromptVariants(prompt), [prompt])
  const issues = useMemo(
    () => validatePromptRules({ chips, hasContent: !!(scene.trim() || scenario) }),
    [chips, scene, scenario]
  )

  const hasContent = prompt.length > 0
  const assembledText = prompt.join(', ')

  const clonePresetChips = useCallback((chipMap) => (
    Object.fromEntries(
      Object.entries(chipMap).map(([groupId, values]) => [groupId, [...values]])
    )
  ), [])

  const toggleChip = useCallback((groupId, value) => {
    setChips(prev => {
      const current = prev[groupId] ?? []
      const has = current.includes(value)
      const next = has ? current.filter(v => v !== value) : [...current, value]
      if (next.length === 0) {
        const { [groupId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [groupId]: next }
    })
  }, [])

  const saveCustomDirector = useCallback((entry) => {
    setCustomDirectors(prev => {
      const idx = prev.findIndex(d => d.key === entry.key)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = entry
        return next
      }
      if (prev.length >= 3) return prev
      return [...prev, entry]
    })
  }, [])

  const deleteCustomDirector = useCallback((key) => {
    setSelectedDir(prev => (prev === key ? null : prev))
    setCustomDirectors(prev => prev.filter(d => d.key !== key))
  }, [])

  const mergeChips = useCallback((chipMap) => {
    setChips(prev => {
      const next = { ...prev }
      for (const [subsectionId, values] of Object.entries(chipMap)) {
        const existing = new Set(prev[subsectionId] ?? [])
        values.forEach(v => existing.add(v))
        next[subsectionId] = [...existing]
      }
      return next
    })
  }, [])

  const captureApplyState = useCallback(() => ({
    scene,
    selectedDir,
    narrativeBeat,
    chips,
  }), [scene, selectedDir, narrativeBeat, chips])

  const beginApplyDiff = useCallback((source) => {
    setPendingApply({
      source,
      before: captureApplyState(),
    })
  }, [captureApplyState])

  useEffect(() => {
    if (!pendingApply) return
    const after = captureApplyState()
    const diff = summarizeApplyDiff(pendingApply.before, after, pendingApply.source)
    if (diff && !isApplyDiffPinned) setApplyDiff(diff)
    setPendingApply(null)
  }, [pendingApply, captureApplyState, scene, selectedDir, narrativeBeat, chips, isApplyDiffPinned])

  const handlePinApplyDiff = useCallback((pinned) => {
    setIsApplyDiffPinned(Boolean(pinned))
  }, [])

  const handleClearApplyDiff = useCallback(() => {
    setApplyDiff(null)
    setIsApplyDiffPinned(false)
  }, [])

  const loadPreset = useCallback((key) => {
    const preset = PRESETS[key] ?? customPresets[key]
    if (!preset) return
    beginApplyDiff('chip preset')
    setChips(clonePresetChips(preset.chips))
    setLastAppliedPresetLabel(preset.label ?? key)
  }, [clonePresetChips, customPresets, beginApplyDiff])

  const blendPresetChips = useCallback((primaryKey, secondaryKey, primaryWeight) => {
    const primary = DIRECTOR_PRESETS[primaryKey]?.chips ?? {}
    const secondary = DIRECTOR_PRESETS[secondaryKey]?.chips ?? {}
    if (!primaryKey || !secondaryKey) return clonePresetChips(primary)
    const dominantPrimary = primaryWeight >= 50
    // Dimensions where only one source should ever be active (validation enforces single-chip).
    const singleSourceDims = new Set(['light', 'shot', 'film'])
    const result = {}
    const allGroups = new Set([...Object.keys(primary), ...Object.keys(secondary)])
    allGroups.forEach((groupId) => {
      const a = primary[groupId] ?? []
      const b = secondary[groupId] ?? []
      if (a.length === 0 && b.length === 0) return
      const dominant = dominantPrimary ? a : b
      const secondaryVals = dominantPrimary ? b : a
      const values = [...dominant]
      // Never merge secondary chips into single-source dimensions — use dominant only.
      if (!singleSourceDims.has(groupId) && secondaryVals[0] && !values.includes(secondaryVals[0])) {
        values.push(secondaryVals[0])
      }
      result[groupId] = values
    })
    return result
  }, [clonePresetChips])

  const applySelectedDirectorPreset = useCallback(() => {
    if (!selectedDir) return
    beginApplyDiff('director preset')
    if (blendEnabled && blendDir) {
      const blended = blendPresetChips(selectedDir, blendDir, blendWeight)
      setChips(blended)
      setLastAppliedPresetLabel(`${DIRECTORS[selectedDir]?.short} ${blendWeight}/${100 - blendWeight} ${DIRECTORS[blendDir]?.short}`)
      return
    }
    const preset = DIRECTOR_PRESETS[selectedDir]
    if (!preset) return
    setChips(clonePresetChips(preset.chips))
    setLastAppliedPresetLabel(preset.label ?? selectedDir)
  }, [selectedDir, blendEnabled, blendDir, blendWeight, blendPresetChips, clonePresetChips, beginApplyDiff])

  const applyRuleFixById = useCallback((issueId) => {
    setChips((prev) => applyRuleFix(prev, issueId))
  }, [])

  const saveCustomPreset = useCallback((name) => {
    const trimmed = (name ?? '').trim()
    if (!trimmed) return false
    const key = `custom-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
    const chipsClone = clonePresetChips(chips)
    setCustomPresets((prev) => ({
      ...prev,
      [key]: { label: trimmed, chips: chipsClone },
    }))
    setLastAppliedPresetLabel(trimmed)
    return true
  }, [chips, clonePresetChips])

  const exportCustomPresets = useCallback(() => {
    const blob = new Blob([JSON.stringify(customPresets, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qpb-custom-presets-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [customPresets])

  const importCustomPresets = useCallback((rawText) => {
    try {
      const parsed = JSON.parse(rawText)
      if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'Invalid file format' }
      const sanitized = Object.fromEntries(
        Object.entries(parsed).filter(([, preset]) => (
          preset &&
          typeof preset === 'object' &&
          typeof preset.label === 'string' &&
          preset.chips &&
          typeof preset.chips === 'object'
        ))
      )
      setCustomPresets((prev) => ({ ...prev, ...sanitized }))
      return { ok: true, count: Object.keys(sanitized).length }
    } catch {
      return { ok: false, reason: 'Could not parse JSON file' }
    }
  }, [])

  const clearAll = useCallback(() => {
    setScene('')
    setSelectedDir(null)
    setScenario(null)
    setChips({})
    setLastAppliedPresetLabel(null)
    setBlendEnabled(false)
    setBlendDir(null)
    setBlendWeight(70)
    setCharCount(1)
    setChars(DEFAULT_CHARS)
    setNarrativeBeat(null)
    setUseStyleKeyForPolish(false)
  }, [])

  const appendScene = useCallback((text) => {
    const t = (text ?? '').trim()
    if (!t) return
    setScene((prev) => (prev.trim() ? `${prev.trim()}\n\n${t}` : t))
  }, [])

  const applyScaffold = useCallback(({ paragraph, chips: patch, figureSync }) => {
    const p = (paragraph ?? '').trim()
    if (p) setScene((prev) => (prev.trim() ? `${prev.trim()}, ${p}` : p))
    if (patch && typeof patch === 'object') {
      setChips((prev) => ({ ...prev, ...patch }))
    }
    if (figureSync?.chars && Array.isArray(figureSync.chars) && figureSync.chars.length >= 3) {
      setCharCount(2)
      setChars(figureSync.chars.map((c, i) => ({
        g: c?.g ?? DEFAULT_CHARS[i]?.g ?? 'person',
        a: c?.a ?? DEFAULT_CHARS[i]?.a ?? '30s',
      })))
      setScenario(null)
    }
  }, [])

  const applyDeck = useCallback(({ scene: deckScene, narrativeBeat: deckBeat, dirKey: deckDirKey, chips: deckChips }) => {
    beginApplyDiff('scene deck apply')
    if (deckScene) {
      setScene((prev) => (prev.trim() ? `${prev.trim()}, ${deckScene}` : deckScene))
    }
    if (deckBeat) {
      setNarrativeBeat(deckBeat)
    }
    if (deckDirKey && DIRECTORS[deckDirKey]) {
      setSelectedDir(deckDirKey)
      setScenario(null)
      setUseStyleKeyForPolish(false)
    }
    if (deckChips && typeof deckChips === 'object') {
      setChips((prev) => ({ ...prev, ...deckChips }))
    }
  }, [beginApplyDiff])

  const applyMatch = useCallback(({ scene: s, dirKey, applyPreset, narrativeBeat: beat, chipPatch }) => {
    beginApplyDiff('library match apply')
    if (s) {
      setScene((prev) => (prev.trim() ? `${prev.trim()}, ${s}` : s))
    }
    if (dirKey && DIRECTORS[dirKey]) {
      setSelectedDir(dirKey)
      setScenario(null)
      setUseStyleKeyForPolish(false)
      if (applyPreset && DIRECTOR_PRESETS[dirKey]) {
        setChips(clonePresetChips(DIRECTOR_PRESETS[dirKey].chips))
        setLastAppliedPresetLabel(DIRECTOR_PRESETS[dirKey].label ?? dirKey)
      }
    }
    if (chipPatch && typeof chipPatch === 'object') {
      setChips((prev) => ({ ...prev, ...chipPatch }))
    }
    if (beat) {
      setNarrativeBeat(beat)
    }
  }, [clonePresetChips, beginApplyDiff])

  const handleDirSelect = useCallback((dirKey) => {
    setNarrativeBeat(null)
    setUseStyleKeyForPolish(false)
    setSelectedDir((prev) => (prev === dirKey ? null : dirKey))
    setScenario(null)
    if (dirKey === blendDir) setBlendDir(null)
  }, [blendDir])

  const handleScenario = useCallback((s) => {
    setScenario(prev => prev === s ? null : s)
  }, [])

  const handleCharChange = useCallback((index, field, value) => {
    setChars(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
    setScenario(null)
  }, [])

  const handleCharCount = useCallback((n) => {
    setCharCount(n)
    setScenario(null)
  }, [])

  const handleBlendConfig = useCallback(({ enabled, dir, weight }) => {
    if (typeof enabled === 'boolean') setBlendEnabled(enabled)
    if (typeof dir !== 'undefined') setBlendDir(dir || null)
    if (typeof weight === 'number') setBlendWeight(weight)
    setScenario(null)
  }, [])

  const handleShareState = useCallback(async () => {
    const encoded = encodeShareState({
      scene,
      dirKey: selectedDir,
      charCount,
      chars,
      scenario,
      chips,
      blendEnabled,
      blendDir,
      blendWeight,
      narrativeBeat,
      useStyleKeyForPolish,
      aiEngine,
      localOnly,
    })
    const url = `${window.location.origin}${window.location.pathname}#state=${encoded}`
    await navigator.clipboard.writeText(url)
  }, [
    scene,
    selectedDir,
    charCount,
    chars,
    scenario,
    chips,
    blendEnabled,
    blendDir,
    blendWeight,
    narrativeBeat,
    useStyleKeyForPolish,
    aiEngine,
    localOnly,
  ])

  const captureWorkspace = useCallback(() => ({
    scene,
    selectedDir,
    charCount,
    chars,
    scenario,
    chips,
    blendEnabled,
    blendDir,
    blendWeight,
    narrativeBeat,
    useStyleKeyForPolish,
    aiEngine,
    localOnly,
  }), [
    scene,
    selectedDir,
    charCount,
    chars,
    scenario,
    chips,
    blendEnabled,
    blendDir,
    blendWeight,
    narrativeBeat,
    useStyleKeyForPolish,
    aiEngine,
    localOnly,
  ])

  const saveProfile = useCallback(async () => {
    const name = window.prompt('Profile name')
    const trimmed = (name ?? '').trim()
    if (!trimmed) return
    const key = `profile-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
    const snapshot = captureWorkspace()
    setProfiles((prev) => ({ ...prev, [key]: { label: trimmed, state: snapshot } }))
    setSelectedProfile(key)
    upsertWorkspaceProfileRemote({ id: key, label: trimmed, state: snapshot }).catch(() => { /* non-critical */ })
  }, [captureWorkspace])

  const restoreWorkspace = useCallback((s) => {
    if (!s || typeof s !== 'object') return
    setScene(typeof s.scene === 'string' ? s.scene : '')
    setSelectedDir(s.selectedDir && DIRECTORS[s.selectedDir] ? s.selectedDir : null)
    setCharCount([1, 2, 3].includes(s.charCount) ? s.charCount : 1)
    setChars(Array.isArray(s.chars) ? s.chars : DEFAULT_CHARS)
    setScenario(typeof s.scenario === 'string' ? s.scenario : null)
    setChips(s.chips && typeof s.chips === 'object' ? s.chips : {})
    setBlendEnabled(Boolean(s.blendEnabled))
    setBlendDir(s.blendDir && DIRECTORS[s.blendDir] ? s.blendDir : null)
    setBlendWeight(typeof s.blendWeight === 'number' ? Math.min(90, Math.max(50, s.blendWeight)) : 70)
    setNarrativeBeat(typeof s.narrativeBeat === 'string' ? s.narrativeBeat : null)
    setUseStyleKeyForPolish(Boolean(s.useStyleKeyForPolish))
    setAiEngine(s.aiEngine === 'local' || s.aiEngine === 'cloud' || s.aiEngine === 'embedded' ? s.aiEngine : 'auto')
    setLocalOnly(Boolean(s.localOnly))
  }, [])

  const loadProfile = useCallback((key) => {
    const entry = profiles[key]
    if (!entry?.state) return
    restoreWorkspace(entry.state)
  }, [profiles, restoreWorkspace])

  const workspaceSnapshot = captureWorkspace()
  const { undo, redo, canUndo, canRedo } = useWorkspaceHistory({
    snapshot: workspaceSnapshot,
    restore: restoreWorkspace,
  })

  useEffect(() => {
    const onKey = (event) => {
      const mod = event.metaKey || event.ctrlKey
      if (!mod) return
      const key = event.key.toLowerCase()
      if (key === 'k') {
        event.preventDefault()
        setPaletteOpen((v) => !v)
      } else if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const deleteProfile = useCallback((key) => {
    setProfiles((prev) => {
      const { [key]: _, ...rest } = prev
      return rest
    })
    if (selectedProfile === key) setSelectedProfile('')
    deleteWorkspaceProfileRemote(key).catch(() => { /* non-critical */ })
  }, [selectedProfile])

  const commands = useMemo(() => [
    { id: 'undo', label: `Undo${canUndo ? '' : ' (nothing to undo)'}`, run: undo, disabled: !canUndo },
    { id: 'redo', label: `Redo${canRedo ? '' : ' (nothing to redo)'}`, run: redo, disabled: !canRedo },
    { id: 'reset', label: 'Reset all', run: clearAll },
    { id: 'share', label: 'Copy share URL', run: () => { handleShareState() } },
    {
      id: 'export-txt',
      label: 'Export prompt as .txt',
      run: () => { promptExportRef.current?.() },
    },
    { id: 'apply-dir-preset', label: 'Apply selected director preset', run: applySelectedDirectorPreset },
    { id: 'focus-match', label: 'Focus scene match', run: () => matcherRef.current?.focus?.() },
    { id: 'save-profile', label: 'Save workspace profile', run: saveProfile },
    {
      id: 'toggle-blend',
      label: blendEnabled ? 'Disable director blend' : 'Enable director blend',
      run: () => setBlendEnabled((v) => !v),
    },
  ], [clearAll, handleShareState, applySelectedDirectorPreset, saveProfile, blendEnabled, undo, redo, canUndo, canRedo])

  return (
    <div className={styles.app}>
      <Header onClear={clearAll} />
      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'builder' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('builder')}
        >
          Prompt Builder
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'characters' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('characters')}
        >
          Character Builder
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'pipeline' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('pipeline')}
        >
          Casting Room
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'actorBank' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('actorBank')}
        >
          Actor Bank
        </button>
      </div>

      {activeTab === 'builder' ? <div className={styles.layout}>
        {/* ── Left panel: all controls ── */}
        <div className={styles.leftPanel}>
          <div className={styles.profileBar}>
            <div className={styles.historyGroup}>
              <button
                className={styles.profileBtn}
                onClick={undo}
                disabled={!canUndo}
                title="Undo (Ctrl/Cmd+Z)"
                aria-label="Undo"
              >
                ↶ Undo
              </button>
              <button
                className={styles.profileBtn}
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)"
                aria-label="Redo"
              >
                ↷ Redo
              </button>
            </div>
            <button className={styles.profileBtn} onClick={saveProfile}>Save profile</button>
            <select
              className={styles.profileSelect}
              value={aiEngine}
              onChange={(e) => setAiEngine(e.target.value)}
              title="AI engine for polish"
            >
              <option value="auto">AI: Auto</option>
              <option value="embedded">AI: Embedded</option>
              <option value="local">AI: Local</option>
              <option value="cloud">AI: Cloud</option>
            </select>
            <button
              className={styles.profileBtn}
              onClick={() => setEmbeddedSetupOpen(true)}
              title="Manage embedded model and sidecar"
            >
              Model...
            </button>
            <span
              className={`${styles.statusDot} ${embeddedStatus?.running ? styles.statusDotReady : styles.statusDotIdle}`}
              title={embeddedStatus?.running ? 'Embedded runtime ready' : 'Embedded runtime not running'}
            />
            <label className={styles.profileCheck}>
              <input
                type="checkbox"
                checked={localOnly}
                onChange={(e) => setLocalOnly(e.target.checked)}
                disabled={aiEngine === 'cloud'}
              />
              Local only
              <span
                className={styles.inlineHint}
                title="Requires Ollama running and the configured model installed. When enabled, cloud fallback is disabled."
                aria-label="Local only requirements"
              >
                ?
              </span>
            </label>
            <select
              className={styles.profileSelect}
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
            >
              <option value="">Select profile...</option>
              {Object.entries(profiles).map(([key, profile]) => (
                <option key={key} value={key}>{profile.label}</option>
              ))}
            </select>
            <button
              className={styles.profileBtn}
              onClick={() => selectedProfile && loadProfile(selectedProfile)}
              disabled={!selectedProfile}
            >
              Load
            </button>
            <button
              className={styles.profileBtn}
              onClick={() => selectedProfile && deleteProfile(selectedProfile)}
              disabled={!selectedProfile}
            >
              Delete
            </button>
          </div>
          <SceneInput value={scene} onChange={setScene} />
          <SceneScaffold charCount={charCount} chars={chars} onApply={applyScaffold} />
          <SceneDeck onApply={applyDeck} selectedDir={selectedDir} />
          <SceneMatcher onApply={applyMatch} matcherRef={matcherRef} />

          <DirectorSection
            selectedDir={selectedDir}
            blendEnabled={blendEnabled}
            blendDir={blendDir}
            blendWeight={blendWeight}
            charCount={charCount}
            chars={chars}
            scenario={scenario}
            narrativeBeat={narrativeBeat}
            useStyleKeyForPolish={useStyleKeyForPolish}
            onDirSelect={handleDirSelect}
            onBlendConfig={handleBlendConfig}
            onCharCountChange={handleCharCount}
            onCharChange={handleCharChange}
            onScenarioSelect={handleScenario}
            onAppendScene={appendScene}
            onNarrativeBeatChange={setNarrativeBeat}
            onUseStyleKeyForPolishChange={setUseStyleKeyForPolish}
            customDirectors={customDirectors}
            onSaveCustomDirector={saveCustomDirector}
            onDeleteCustomDirector={deleteCustomDirector}
          />

          <ChipSection
            chips={chips}
            onToggle={toggleChip}
            onMergeChips={mergeChips}
            onPreset={loadPreset}
            selectedDir={selectedDir}
            onApplySelectedDirectorPreset={applySelectedDirectorPreset}
            lastAppliedPresetLabel={lastAppliedPresetLabel}
            customPresets={customPresets}
            onSaveCustomPreset={saveCustomPreset}
            onExportCustomPresets={exportCustomPresets}
            onImportCustomPresets={importCustomPresets}
          />

          <BatchExplorer scenario={scenario} chips={chips} />
        </div>

        {/* ── Right panel: output (sticky) ── */}
        <div className={styles.rightPanel}>
          <PromptOutput
            prompt={prompt}
            scene={scene}
            scenario={scenario}
            chips={chips}
            variants={variants}
            issues={issues}
            onApplyRuleFix={applyRuleFixById}
            onShareState={handleShareState}
            directorName={selectedDir ? DIRECTORS[selectedDir]?.name : null}
            directorNote={polishDirectorNote}
            narrativeBeat={narrativeBeat}
            applyDiff={applyDiff}
            isApplyDiffPinned={isApplyDiffPinned}
            onPinApplyDiff={handlePinApplyDiff}
            onClearApplyDiff={handleClearApplyDiff}
            exportFilenameBase={exportFilenameBase}
            promptExportRef={promptExportRef}
            aiEngine={aiEngine}
            localOnly={localOnly}
            embeddedStatus={embeddedStatus}
          />
          <ReferenceBoard />
        </div>
        <MobilePromptBar
          displayText={assembledText}
          hasContent={hasContent}
        />
      </div> : activeTab === 'characters' ? (
        <div className={styles.characterTab}>
          <CharacterBuilder
            characters={characters}
            setCharacters={setCharacters}
            aiEngine={aiEngine}
            localOnly={localOnly}
            embeddedStatus={embeddedStatus}
          />
        </div>
      ) : activeTab === 'pipeline' ? (
        <div className={styles.characterTab}>
          <CastingPipelinePanel />
        </div>
      ) : (
        <div className={styles.characterTab}>
          <ActorBankView />
        </div>
      )}
      <EmbeddedSetup
        open={embeddedSetupOpen}
        onClose={() => setEmbeddedSetupOpen(false)}
        onStatusChange={setEmbeddedStatus}
      />
      <CommandPalette
        open={paletteOpen}
        commands={commands}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  )
}
