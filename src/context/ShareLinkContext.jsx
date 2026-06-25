import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { useProject } from './ProjectContext.jsx'
import { useWorkspace } from './WorkspaceContext.jsx'

export const CURRENT_SHARE_VERSION = 3

const WORKFLOW_LS_KEY = 'qpb.workflow.v1'

const WORKFLOW_DEFAULTS = {
  step: 1,
  projectId: null,
  charId: null,
  entityId: null,
  bankSlug: null,
}

function sanitizeCharsForShare(chars) {
  if (!Array.isArray(chars)) return chars
  return chars.map((c) => {
    if (!c || typeof c !== 'object') return c
    const { thumbnailUrl: _t, ...rest } = c
    return rest
  })
}

/** @param {unknown} state */
export function packBlend(state) {
  if (state && typeof state === 'object' && state.blend && typeof state.blend === 'object') {
    const b = state.blend
    return {
      enabled: Boolean(b.enabled),
      dirKey: typeof b.dirKey === 'string' || b.dirKey === null ? b.dirKey : null,
      weight: typeof b.weight === 'number' ? b.weight : 70,
    }
  }
  return {
    enabled: Boolean(state?.blendEnabled),
    dirKey: typeof state?.blendDir === 'string' || state?.blendDir === null ? state.blendDir : null,
    weight: typeof state?.blendWeight === 'number' ? state.blendWeight : 70,
  }
}

/** @param {unknown} decoded */
export function unpackBlendForWorkspace(decoded) {
  if (decoded && typeof decoded === 'object' && decoded.blend && typeof decoded.blend === 'object') {
    const b = decoded.blend
    return {
      blendEnabled: Boolean(b.enabled),
      blendDir: typeof b.dirKey === 'string' || b.dirKey === null ? b.dirKey : null,
      blendWeight: typeof b.weight === 'number' ? b.weight : 70,
    }
  }
  return {
    blendEnabled: Boolean(decoded?.blendEnabled),
    blendDir: typeof decoded?.blendDir === 'string' || decoded?.blendDir === null ? decoded.blendDir : null,
    blendWeight: typeof decoded?.blendWeight === 'number' ? decoded.blendWeight : 70,
  }
}

/**
 * @param {Record<string, unknown>} parsed
 * @returns {Record<string, unknown>}
 */
function decodeShareV1(parsed) {
  return {
    v: 3,
    ...WORKFLOW_DEFAULTS,
    scene: typeof parsed.scene === 'string' ? parsed.scene : '',
    dirKey: typeof parsed.dirKey === 'string' || parsed.dirKey === null ? parsed.dirKey : null,
    charCount: [1, 2, 3].includes(parsed.charCount) ? parsed.charCount : 1,
    chars: sanitizeCharsForShare(parsed.chars),
    scenario: typeof parsed.scenario === 'string' || parsed.scenario === null ? parsed.scenario : null,
    chips: parsed.chips && typeof parsed.chips === 'object' ? parsed.chips : {},
    blend: packBlend(parsed),
    narrativeBeat:
      typeof parsed.narrativeBeat === 'string' || parsed.narrativeBeat === null
        ? parsed.narrativeBeat
        : null,
    useStyleKeyForPolish: typeof parsed.useStyleKeyForPolish === 'boolean'
      ? parsed.useStyleKeyForPolish
      : undefined,
    aiEngine: parsed.aiEngine,
    localOnly: typeof parsed.localOnly === 'boolean' ? parsed.localOnly : undefined,
  }
}

/**
 * @param {Record<string, unknown>} parsed
 * @returns {Record<string, unknown>}
 */
function decodeShareV2(parsed) {
  return {
    ...decodeShareV1(parsed),
    v: 3,
    projectId:
      typeof parsed.projectId === 'string' || parsed.projectId === null
        ? parsed.projectId
        : WORKFLOW_DEFAULTS.projectId,
    charId:
      typeof parsed.charId === 'string' || parsed.charId === null
        ? parsed.charId
        : WORKFLOW_DEFAULTS.charId,
  }
}

/**
 * @param {Record<string, unknown>} parsed
 * @returns {Record<string, unknown>}
 */
function decodeShareV3(parsed) {
  return {
    v: 3,
    step: typeof parsed.step === 'number' ? parsed.step : WORKFLOW_DEFAULTS.step,
    projectId:
      typeof parsed.projectId === 'string' || parsed.projectId === null
        ? parsed.projectId
        : WORKFLOW_DEFAULTS.projectId,
    charId:
      typeof parsed.charId === 'string' || parsed.charId === null
        ? parsed.charId
        : WORKFLOW_DEFAULTS.charId,
    entityId:
      typeof parsed.entityId === 'string' || parsed.entityId === null
        ? parsed.entityId
        : WORKFLOW_DEFAULTS.entityId,
    bankSlug:
      typeof parsed.bankSlug === 'string' || parsed.bankSlug === null
        ? parsed.bankSlug
        : WORKFLOW_DEFAULTS.bankSlug,
    scene: typeof parsed.scene === 'string' ? parsed.scene : '',
    dirKey: typeof parsed.dirKey === 'string' || parsed.dirKey === null ? parsed.dirKey : null,
    charCount: [1, 2, 3].includes(parsed.charCount) ? parsed.charCount : 1,
    chars: sanitizeCharsForShare(parsed.chars),
    scenario: typeof parsed.scenario === 'string' || parsed.scenario === null ? parsed.scenario : null,
    chips: parsed.chips && typeof parsed.chips === 'object' ? parsed.chips : {},
    blend: packBlend(parsed),
    narrativeBeat:
      typeof parsed.narrativeBeat === 'string' || parsed.narrativeBeat === null
        ? parsed.narrativeBeat
        : null,
    useStyleKeyForPolish: typeof parsed.useStyleKeyForPolish === 'boolean'
      ? parsed.useStyleKeyForPolish
      : undefined,
    aiEngine: parsed.aiEngine,
    localOnly: typeof parsed.localOnly === 'boolean' ? parsed.localOnly : undefined,
  }
}

/**
 * @param {Record<string, unknown>} parsed
 * @returns {Record<string, unknown> | null}
 */
export function decodeSharePayload(parsed) {
  if (!parsed || typeof parsed !== 'object') return null
  const version = parsed.v
  if (version === 3) return decodeShareV3(parsed)
  if (version === 2) return decodeShareV2(parsed)
  if (!version || version === 1) return decodeShareV1(parsed)
  if (typeof version === 'number' && version < 3) return decodeShareV2({ ...parsed, v: 2 })
  return decodeShareV3(parsed)
}

export function encodeShareState(state) {
  const canonical = decodeSharePayload({
    v: 3,
    ...state,
    chars: sanitizeCharsForShare(state?.chars),
    blend: packBlend(state),
  })
  const payload = {
    v: CURRENT_SHARE_VERSION,
    step: canonical.step,
    projectId: canonical.projectId,
    charId: canonical.charId,
    entityId: canonical.entityId,
    bankSlug: canonical.bankSlug,
    scene: canonical.scene,
    dirKey: canonical.dirKey,
    charCount: canonical.charCount,
    chars: canonical.chars,
    scenario: canonical.scenario,
    chips: canonical.chips,
    blend: canonical.blend,
    narrativeBeat: canonical.narrativeBeat,
    useStyleKeyForPolish: canonical.useStyleKeyForPolish,
    aiEngine: canonical.aiEngine,
    localOnly: canonical.localOnly,
  }
  const json = JSON.stringify(payload)
  return btoa(unescape(encodeURIComponent(json)))
}

export function decodeShareState(raw) {
  try {
    const json = decodeURIComponent(escape(atob(raw)))
    const parsed = JSON.parse(json)
    return decodeSharePayload(parsed)
  } catch {
    return null
  }
}

/** @param {Record<string, unknown> | null} hashDecoded @param {Record<string, unknown> | null} localDecoded */
export function resolveShareBootstrap(hashDecoded, localDecoded) {
  if (hashDecoded && typeof hashDecoded === 'object') return hashDecoded
  if (localDecoded && typeof localDecoded === 'object') return localDecoded
  return null
}

/** @param {Record<string, unknown>} canonical */
export function toWorkspaceSharePayload(canonical) {
  const blendFields = unpackBlendForWorkspace(canonical)
  return {
    scene: canonical.scene,
    dirKey: canonical.dirKey,
    charCount: canonical.charCount,
    chars: canonical.chars,
    scenario: canonical.scenario,
    chips: canonical.chips,
    narrativeBeat: canonical.narrativeBeat,
    useStyleKeyForPolish: canonical.useStyleKeyForPolish,
    aiEngine: canonical.aiEngine,
    localOnly: canonical.localOnly,
    ...blendFields,
  }
}

/** @param {Record<string, unknown>} canonical */
export function extractWorkflowShareFields(canonical) {
  return {
    step: typeof canonical.step === 'number' ? canonical.step : WORKFLOW_DEFAULTS.step,
    projectId: canonical.projectId ?? WORKFLOW_DEFAULTS.projectId,
    charId: canonical.charId ?? WORKFLOW_DEFAULTS.charId,
    entityId: canonical.entityId ?? WORKFLOW_DEFAULTS.entityId,
    bankSlug: canonical.bankSlug ?? WORKFLOW_DEFAULTS.bankSlug,
  }
}

export function readWorkflowLocalStorage() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(WORKFLOW_LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/** @param {Record<string, unknown>} wf */
export function workflowLocalStorageToCanonical(wf) {
  return decodeSharePayload({
    v: 3,
    step: wf.activeStep ?? wf.step ?? WORKFLOW_DEFAULTS.step,
    projectId: wf.activeProjectId ?? wf.projectId ?? null,
    charId: wf.activeCharId ?? wf.charId ?? null,
    entityId: wf.activeEntityId ?? wf.entityId ?? null,
    bankSlug: wf.activeBankSlug ?? wf.bankSlug ?? null,
    scene: wf.scene ?? '',
    dirKey: wf.dirKey ?? null,
    charCount: wf.charCount ?? 1,
    chars: wf.chars,
    scenario: wf.scenario ?? null,
    chips: wf.chips ?? {},
    blend: wf.blend ?? packBlend(wf),
    narrativeBeat: wf.narrativeBeat ?? null,
  })
}

const ShareLinkContext = createContext(null)

const workflowApplyListeners = new Set()

function notifyWorkflowShareApply(fields) {
  for (const listener of workflowApplyListeners) {
    listener(fields)
  }
}

/** @param {{ children: import('react').ReactNode }} props */
export function ShareLinkProvider({ children }) {
  const { active } = useProject()
  const { captureSharePayload, applyShareDecoded } = useWorkspace()
  const workflowGetterRef = useRef(/** @type {(() => Record<string, unknown>) | null} */ (null))
  const lastWorkflowApplyRef = useRef(/** @type {Record<string, unknown> | null} */ (null))

  const registerWorkflowShareSource = useCallback((getter) => {
    workflowGetterRef.current = getter
    return () => {
      if (workflowGetterRef.current === getter) {
        workflowGetterRef.current = null
      }
    }
  }, [])

  const subscribeWorkflowShareApply = useCallback((listener) => {
    workflowApplyListeners.add(listener)
    if (lastWorkflowApplyRef.current) {
      listener(lastWorkflowApplyRef.current)
    }
    return () => workflowApplyListeners.delete(listener)
  }, [])

  const handleShareState = useCallback(async () => {
    const workflow = workflowGetterRef.current?.() ?? {}
    const encoded = encodeShareState({
      ...captureSharePayload(),
      step: typeof workflow.step === 'number' ? workflow.step : 1,
      projectId: workflow.projectId ?? active?.id ?? null,
      charId: workflow.charId ?? null,
      entityId: workflow.entityId ?? null,
      bankSlug: workflow.bankSlug ?? null,
    })
    const url = `${window.location.origin}${window.location.pathname}#state=${encoded}`
    await navigator.clipboard.writeText(url)
  }, [captureSharePayload, active?.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    const hashDecoded = hash.startsWith('#state=')
      ? decodeShareState(hash.slice('#state='.length))
      : null
    const lsRaw = readWorkflowLocalStorage()
    const localDecoded = lsRaw ? workflowLocalStorageToCanonical(lsRaw) : null
    const canonical = resolveShareBootstrap(hashDecoded, localDecoded)
    if (!canonical) return
    applyShareDecoded(toWorkspaceSharePayload(canonical))
    const workflowFields = extractWorkflowShareFields(canonical)
    lastWorkflowApplyRef.current = workflowFields
    notifyWorkflowShareApply(workflowFields)
  }, [applyShareDecoded])

  const value = useMemo(
    () => ({
      handleShareState,
      encodeShareState,
      decodeShareState,
      decodeSharePayload,
      resolveShareBootstrap,
      toWorkspaceSharePayload,
      extractWorkflowShareFields,
      registerWorkflowShareSource,
      subscribeWorkflowShareApply,
      CURRENT_SHARE_VERSION,
    }),
    [
      handleShareState,
      registerWorkflowShareSource,
      subscribeWorkflowShareApply,
    ],
  )

  return (
    <ShareLinkContext.Provider value={value}>
      {children}
    </ShareLinkContext.Provider>
  )
}

export function useShareLink() {
  const ctx = useContext(ShareLinkContext)
  if (!ctx) {
    throw new Error('useShareLink must be used within a ShareLinkProvider')
  }
  return ctx
}
