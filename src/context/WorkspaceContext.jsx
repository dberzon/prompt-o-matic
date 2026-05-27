import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { fetchWorkspaceProfiles, upsertWorkspaceProfileRemote, deleteWorkspaceProfileRemote } from '../api/promptStorage.js'
import { assemblePrompt } from '../utils/assembler.js'
import { toSnakeSlug } from '../utils/slugify.js'
import { ageToBracket, genderPresentationToG } from '../utils/actorBankMapping.js'
import { PRESETS, DIRECTOR_PRESETS } from '../data/constants.js'
import { DIRECTORS } from '../data/directors.js'
import { getSceneBankEntry } from '../data/sceneBank.js'
import { validatePromptRules, applyRuleFix } from '../utils/promptRules.js'
import { generatePromptVariants } from '../utils/variants.js'
import { useWorkspaceHistory } from '../hooks/useWorkspaceHistory.js'

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

export const WORKFLOW_PERSIST_KEY = 'qpb.workflow.v1'
export const WORKFLOW_PERSIST_DEBOUNCE_MS = 500

export function readWorkflowPersistSnapshot() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(WORKFLOW_PERSIST_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function blendFieldsFromPersist(snapshot) {
  if (snapshot?.blend && typeof snapshot.blend === 'object') {
    const b = snapshot.blend
    return {
      blendEnabled: Boolean(b.enabled),
      blendDir: typeof b.dirKey === 'string' && DIRECTORS[b.dirKey] ? b.dirKey : null,
      blendWeight: typeof b.weight === 'number' ? Math.min(90, Math.max(50, b.weight)) : 70,
    }
  }
  return {
    blendEnabled: Boolean(snapshot?.blendEnabled),
    blendDir: snapshot?.blendDir && DIRECTORS[snapshot.blendDir] ? snapshot.blendDir : null,
    blendWeight: typeof snapshot?.blendWeight === 'number'
      ? Math.min(90, Math.max(50, snapshot.blendWeight))
      : 70,
  }
}

const WORKFLOW_SUB_TABS = new Set(['casting-pipeline', 'character-builder', 'actor-bank'])

function normalizeWorkflowStep(value) {
  return Number.isInteger(value) && value >= 1 && value <= 6 ? value : 1
}

function normalizeWorkflowSubTab(value) {
  return WORKFLOW_SUB_TABS.has(value) ? value : 'casting-pipeline'
}

function normalizeNullableString(value) {
  return typeof value === 'string' || value === null ? value ?? null : null
}

/**
 * @param {Record<string, unknown>} workspace
 * @param {{
 *   activeProjectId?: string | null,
 *   activeCharId?: string | null,
 *   activeEntityId?: string | null,
 *   activeBankSlug?: string | null,
 *   activeStep?: number,
 *   activeSubTab?: string,
 * }} [extras]
 */
export function buildWorkflowPersistPayload(workspace, extras = {}) {
  return {
    scene: typeof workspace.scene === 'string' ? workspace.scene : '',
    dirKey: typeof workspace.selectedDir === 'string' || workspace.selectedDir === null
      ? workspace.selectedDir
      : null,
    charCount: [1, 2, 3].includes(workspace.charCount) ? workspace.charCount : 1,
    chars: Array.isArray(workspace.chars) ? workspace.chars : DEFAULT_CHARS,
    scenario: typeof workspace.scenario === 'string' || workspace.scenario === null
      ? workspace.scenario
      : null,
    chips: workspace.chips && typeof workspace.chips === 'object' ? workspace.chips : {},
    blend: {
      enabled: Boolean(workspace.blendEnabled),
      dirKey: typeof workspace.blendDir === 'string' || workspace.blendDir === null
        ? workspace.blendDir
        : null,
      weight: typeof workspace.blendWeight === 'number' ? workspace.blendWeight : 70,
    },
    narrativeBeat: typeof workspace.narrativeBeat === 'string' || workspace.narrativeBeat === null
      ? workspace.narrativeBeat
      : null,
    activeProjectId:
      typeof extras.activeProjectId === 'string' || extras.activeProjectId === null
        ? extras.activeProjectId ?? null
        : null,
    activeCharId:
      typeof extras.activeCharId === 'string' || extras.activeCharId === null
        ? extras.activeCharId ?? null
        : null,
    activeEntityId: normalizeNullableString(extras.activeEntityId),
    activeBankSlug: normalizeNullableString(extras.activeBankSlug),
    activeStep: normalizeWorkflowStep(extras.activeStep),
    activeSubTab: normalizeWorkflowSubTab(extras.activeSubTab),
  }
}

function workspaceSeedFromPersist(snapshot) {
  if (!snapshot) return null
  const blend = blendFieldsFromPersist(snapshot)
  const dirKey = snapshot.dirKey
  return {
    scene: typeof snapshot.scene === 'string' ? snapshot.scene : '',
    selectedDir: typeof dirKey === 'string' && DIRECTORS[dirKey] ? dirKey : null,
    charCount: [1, 2, 3].includes(snapshot.charCount) ? snapshot.charCount : 1,
    chars: Array.isArray(snapshot.chars) && snapshot.chars.length > 0 ? snapshot.chars : DEFAULT_CHARS,
    scenario: typeof snapshot.scenario === 'string' ? snapshot.scenario : null,
    chips: snapshot.chips && typeof snapshot.chips === 'object' ? snapshot.chips : {},
    narrativeBeat: typeof snapshot.narrativeBeat === 'string' ? snapshot.narrativeBeat : null,
    ...blend,
    activeProjectId: snapshot.activeProjectId ?? null,
    activeCharId: snapshot.activeCharId ?? null,
    activeEntityId: normalizeNullableString(snapshot.activeEntityId),
    activeBankSlug: normalizeNullableString(snapshot.activeBankSlug),
    activeStep: normalizeWorkflowStep(snapshot.activeStep),
    activeSubTab: normalizeWorkflowSubTab(snapshot.activeSubTab),
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

const WorkspaceContext = createContext(null)

/** @param {{ children: import('react').ReactNode }} props */
export function WorkspaceProvider({ children }) {
  const [persistSeed] = useState(() => workspaceSeedFromPersist(readWorkflowPersistSnapshot()))
  const [scene, setScene] = useState(persistSeed?.scene ?? '')
  const [selectedDir, setSelectedDir] = useState(persistSeed?.selectedDir ?? null)
  const [charCount, setCharCount] = useState(persistSeed?.charCount ?? 1)
  const [chars, setChars] = useState(persistSeed?.chars ?? DEFAULT_CHARS)
  const [scenario, setScenario] = useState(persistSeed?.scenario ?? null)
  const [chips, setChips] = useState(persistSeed?.chips ?? {})
  const [lastAppliedPresetLabel, setLastAppliedPresetLabel] = useState(null)
  const [blendEnabled, setBlendEnabled] = useState(persistSeed?.blendEnabled ?? false)
  const [blendDir, setBlendDir] = useState(persistSeed?.blendDir ?? null)
  const [blendWeight, setBlendWeight] = useState(persistSeed?.blendWeight ?? 70)
  const [customPresets, setCustomPresets] = useState(() => readCustomPresets())
  const [customDirectors, setCustomDirectors] = useState(() => readCustomDirectors())
  const [profiles, setProfiles] = useState({})
  const [selectedProfile, setSelectedProfile] = useState('')
  const [narrativeBeat, setNarrativeBeat] = useState(persistSeed?.narrativeBeat ?? null)
  const [useStyleKeyForPolish, setUseStyleKeyForPolish] = useState(false)
  const [applyDiff, setApplyDiff] = useState(null)
  const [isApplyDiffPinned, setIsApplyDiffPinned] = useState(false)
  const [pendingApply, setPendingApply] = useState(null)
  const [aiEngine, setAiEngine] = useState(() => readAiEngine())
  const [localOnly, setLocalOnly] = useState(() => readLocalOnly())
  const [characters, setCharacters] = useState(() => readCharacters())
  const [bankCharsForSelector, setBankCharsForSelector] = useState([])
  const [persistExtrasRevision, setPersistExtrasRevision] = useState(0)
  const workflowPersistGetterRef = useRef(/** @type {(() => {
    activeProjectId?: string | null,
    activeCharId?: string | null,
    activeEntityId?: string | null,
    activeBankSlug?: string | null,
    activeStep?: number,
    activeSubTab?: string,
  }) | null} */ (null))
  const restoredWorkflowIds = useMemo(() => ({
    activeProjectId: persistSeed?.activeProjectId ?? null,
    activeCharId: persistSeed?.activeCharId ?? null,
    activeEntityId: persistSeed?.activeEntityId ?? null,
    activeBankSlug: persistSeed?.activeBankSlug ?? null,
    activeStep: persistSeed?.activeStep ?? 1,
    activeSubTab: persistSeed?.activeSubTab ?? 'casting-pipeline',
  }), [persistSeed])

  const registerWorkflowPersistSource = useCallback((getter) => {
    workflowPersistGetterRef.current = getter
    setPersistExtrasRevision((n) => n + 1)
    return () => {
      if (workflowPersistGetterRef.current === getter) {
        workflowPersistGetterRef.current = null
        setPersistExtrasRevision((n) => n + 1)
      }
    }
  }, [])

  useEffect(() => {
    const extras = workflowPersistGetterRef.current?.() ?? {}
    const payload = buildWorkflowPersistPayload({
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
    }, extras)
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(WORKFLOW_PERSIST_KEY, JSON.stringify(payload))
      } catch {
        /* quota or private mode */
      }
    }, WORKFLOW_PERSIST_DEBOUNCE_MS)
    return () => clearTimeout(timer)
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
    persistExtrasRevision,
  ])

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

  const fetchBankSlugs = useCallback(() => {
    fetch('/api/characters/slugs')
      .then(r => r.json())
      .then(data => {
        const items = data.items ?? []
        setBankCharsForSelector(items.map(char => ({
          id: char.id,
          slug: char.slug ?? toSnakeSlug(char.name ?? ''),
          name: char.name ?? 'Unnamed',
          age: char.age ?? null,
          genderPresentation: char.genderPresentation ?? null,
          promptDescriptor: char.promptDescriptor ?? null,
          thumbnailUrl: char.thumbnailUrl ?? null,
        })))
      })
      .catch(() => {})
  }, [])

  useEffect(() => { fetchBankSlugs() }, [fetchBankSlugs])

  // After bank slugs load (and after any chars change such as profile restore),
  // hydrate any chars slot that has an actorBankId: fill in missing
  // promptDescriptor/thumbnailUrl from the lookup, or clear bank fields if
  // the referenced character no longer exists. Settles in one cycle since
  // setChars returns prev when nothing actually changes.
  useEffect(() => {
    if (bankCharsForSelector.length === 0) return
    setChars((prev) => {
      let changed = false
      const byId = new Map(bankCharsForSelector.map((c) => [c.id, c]))
      const next = prev.map((slot) => {
        if (!slot?.actorBankId) return slot
        const found = byId.get(slot.actorBankId)
        if (!found) {
          changed = true
          const { actorBankId: _a, name: _n, promptDescriptor: _pd, thumbnailUrl: _t, ...rest } = slot
          return { g: rest.g ?? 'person', a: rest.a ?? '30s', ...rest }
        }
        const needsName = !slot.name && found.name
        const needsDesc = !slot.promptDescriptor && found.promptDescriptor
        const needsThumb = !slot.thumbnailUrl && found.thumbnailUrl
        if (!needsName && !needsDesc && !needsThumb) return slot
        changed = true
        return {
          ...slot,
          name: slot.name ?? found.name,
          promptDescriptor: slot.promptDescriptor ?? found.promptDescriptor,
          thumbnailUrl: slot.thumbnailUrl ?? found.thumbnailUrl,
        }
      })
      return changed ? next : prev
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankCharsForSelector, chars])

  const actorBankSlugs = useMemo(() => {
    const dict = {}
    for (const c of bankCharsForSelector) {
      if (c.slug) dict[c.slug] = { promptDescriptor: c.promptDescriptor ?? null }
    }
    return dict
  }, [bankCharsForSelector])

  const availableSlugs = useMemo(() => {
    const cbSlugs = Object.entries(characters).map(([slug, entry]) => ({
      slug,
      name: entry.name ?? slug,
      source: 'Cast',
    }))
    const cbSlugSet = new Set(cbSlugs.map(s => s.slug))
    const bankSlugs = bankCharsForSelector
      .filter(c => c.slug && !cbSlugSet.has(c.slug))
      .map(c => ({ slug: c.slug, name: c.name, source: 'Bank' }))
    return [...cbSlugs, ...bankSlugs]
  }, [characters, bankCharsForSelector])

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
    () => assemblePrompt({ scene, scenario, chips, characters, actorBankSlugs }),
    [scene, scenario, chips, characters, actorBankSlugs]
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
      if (prev.length >= 10) return prev
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
      if (field === 'bankLink') {
        if (value) {
          next[index] = {
            ...next[index],
            actorBankId: value.id,
            name: value.name,
            promptDescriptor: value.promptDescriptor ?? null,
            thumbnailUrl: value.thumbnailUrl ?? null,
            g: genderPresentationToG(value.genderPresentation),
            a: ageToBracket(value.age),
          }
        } else {
          const { actorBankId: _id, name: _n, promptDescriptor: _pd, thumbnailUrl: _t, ...rest } = next[index]
          next[index] = { g: rest.g ?? 'person', a: rest.a ?? '30s', ...rest }
        }
      } else {
        next[index] = { ...next[index], [field]: value }
      }
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

  
  const captureSharePayload = useCallback(() => ({
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

  const applyShareDecoded = useCallback((decoded) => {
    if (!decoded || typeof decoded !== 'object') return
    if (typeof decoded.scene === 'string') setScene(decoded.scene)
    if (typeof decoded.dirKey === 'string' || decoded.dirKey === null) {
      setSelectedDir(decoded.dirKey && DIRECTORS[decoded.dirKey] ? decoded.dirKey : null)
    }
    if ([1, 2, 3].includes(decoded.charCount)) setCharCount(decoded.charCount)
    if (Array.isArray(decoded.chars) && decoded.chars.length > 0) {
      const normalized = DEFAULT_CHARS.map((base, i) => {
        const src = decoded.chars[i] ?? {}
        const slot = { g: src.g ?? base.g, a: src.a ?? base.a }
        if (src.actorBankId) {
          slot.actorBankId = src.actorBankId
          if (src.name) slot.name = src.name
          if (src.promptDescriptor) slot.promptDescriptor = src.promptDescriptor
        }
        return slot
      })
      setChars(normalized)
    }
    if (typeof decoded.scenario === 'string' || decoded.scenario === null) {
      setScenario(decoded.scenario)
    }
    if (decoded.chips && typeof decoded.chips === 'object') {
      const safeChips = Object.fromEntries(
        Object.entries(decoded.chips)
          .filter(([, v]) => Array.isArray(v))
          .map(([k, v]) => [k, v.filter((item) => typeof item === 'string')]),
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

  const workspaceSnapshot = captureWorkspace()
  const { undo, redo, canUndo, canRedo } = useWorkspaceHistory({
    snapshot: workspaceSnapshot,
    restore: restoreWorkspace,
  })

  const deleteProfile = useCallback((key) => {
    setProfiles((prev) => {
      const { [key]: _, ...rest } = prev
      return rest
    })
    if (selectedProfile === key) setSelectedProfile('')
    deleteWorkspaceProfileRemote(key).catch(() => { /* non-critical */ })
  }, [selectedProfile])

  const value = useMemo(
    () => ({
      scene,
      setScene,
      selectedDir,
      setSelectedDir,
      charCount,
      setCharCount,
      chars,
      setChars,
      scenario,
      setScenario,
      chips,
      setChips,
      lastAppliedPresetLabel,
      setLastAppliedPresetLabel,
      blendEnabled,
      setBlendEnabled,
      blendDir,
      setBlendDir,
      blendWeight,
      setBlendWeight,
      customPresets,
      setCustomPresets,
      customDirectors,
      setCustomDirectors,
      profiles,
      setProfiles,
      selectedProfile,
      setSelectedProfile,
      narrativeBeat,
      setNarrativeBeat,
      useStyleKeyForPolish,
      setUseStyleKeyForPolish,
      applyDiff,
      setApplyDiff,
      isApplyDiffPinned,
      setIsApplyDiffPinned,
      aiEngine,
      setAiEngine,
      localOnly,
      setLocalOnly,
      characters,
      setCharacters,
      bankCharsForSelector,
      polishDirectorNote,
      exportFilenameBase,
      prompt,
      variants,
      issues,
      hasContent,
      assembledText,
      actorBankSlugs,
      availableSlugs,
      toggleChip,
      saveCustomDirector,
      deleteCustomDirector,
      mergeChips,
      clearAll,
      appendScene,
      applyScaffold,
      applyDeck,
      applyMatch,
      handleDirSelect,
      handleScenario,
      handleCharChange,
      handleCharCount,
      handleBlendConfig,
      captureWorkspace,
      restoreWorkspace,
      saveProfile,
      loadProfile,
      deleteProfile,
      undo,
      redo,
      canUndo,
      canRedo,
      applyRuleFixById,
      loadPreset,
      applySelectedDirectorPreset,
      handlePinApplyDiff,
      handleClearApplyDiff,
      saveCustomPreset,
      exportCustomPresets,
      importCustomPresets,
      captureSharePayload,
      applyShareDecoded,
      fetchBankSlugs,
      restoredWorkflowIds,
      registerWorkflowPersistSource,
    }),
    [
      scene,
      selectedDir,
      charCount,
      chars,
      scenario,
      chips,
      lastAppliedPresetLabel,
      blendEnabled,
      blendDir,
      blendWeight,
      customPresets,
      customDirectors,
      profiles,
      selectedProfile,
      narrativeBeat,
      useStyleKeyForPolish,
      applyDiff,
      isApplyDiffPinned,
      aiEngine,
      localOnly,
      characters,
      bankCharsForSelector,
      polishDirectorNote,
      exportFilenameBase,
      prompt,
      variants,
      issues,
      hasContent,
      assembledText,
      actorBankSlugs,
      availableSlugs,
      toggleChip,
      saveCustomDirector,
      deleteCustomDirector,
      mergeChips,
      clearAll,
      appendScene,
      applyScaffold,
      applyDeck,
      applyMatch,
      handleDirSelect,
      handleScenario,
      handleCharChange,
      handleCharCount,
      handleBlendConfig,
      captureWorkspace,
      restoreWorkspace,
      saveProfile,
      loadProfile,
      deleteProfile,
      undo,
      redo,
      canUndo,
      canRedo,
      applyRuleFixById,
      loadPreset,
      applySelectedDirectorPreset,
      handlePinApplyDiff,
      handleClearApplyDiff,
      saveCustomPreset,
      exportCustomPresets,
      importCustomPresets,
      captureSharePayload,
      applyShareDecoded,
      fetchBankSlugs,
      restoredWorkflowIds,
      registerWorkflowPersistSource,
    ],
  )

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return ctx
}
