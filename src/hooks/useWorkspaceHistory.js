import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Bounded history stack for an arbitrary serializable workspace snapshot.
 *
 *  - Debounces captures so a burst of changes (e.g. typing in a textarea)
 *    collapses into a single undoable entry.
 *  - Pushing a new entry clears the redo stack, mirroring standard editor behavior.
 *  - While restoring (undo / redo), captures are suppressed so the restoration
 *    itself is not recorded as a new history entry.
 *
 * Usage:
 *   const snapshot = useMemo(() => ({ scene, dir, chips, ... }), [scene, dir, chips])
 *   const { undo, redo, canUndo, canRedo } = useWorkspaceHistory({
 *     snapshot,
 *     restore: (state) => { setScene(state.scene); setDir(state.dir); ... },
 *   })
 */
export function useWorkspaceHistory({
  snapshot,
  restore,
  limit = 50,
  debounceMs = 400,
}) {
  const pastRef = useRef([])
  const futureRef = useRef([])
  const lastCommittedRef = useRef(null)
  const suppressRef = useRef(false)
  const timerRef = useRef(null)
  const [version, setVersion] = useState(0)

  const serialized = JSON.stringify(snapshot)

  useEffect(() => {
    if (lastCommittedRef.current === null) {
      lastCommittedRef.current = serialized
      return
    }
    if (suppressRef.current) {
      suppressRef.current = false
      lastCommittedRef.current = serialized
      return
    }
    if (serialized === lastCommittedRef.current) return

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      pastRef.current.push(lastCommittedRef.current)
      if (pastRef.current.length > limit) pastRef.current.shift()
      futureRef.current = []
      lastCommittedRef.current = serialized
      setVersion((v) => v + 1)
    }, debounceMs)

    return () => clearTimeout(timerRef.current)
  }, [serialized, limit, debounceMs])

  /** Flushes any pending debounced capture immediately (called before undo/redo). */
  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (lastCommittedRef.current !== null && serialized !== lastCommittedRef.current) {
      pastRef.current.push(lastCommittedRef.current)
      if (pastRef.current.length > limit) pastRef.current.shift()
      futureRef.current = []
      lastCommittedRef.current = serialized
    }
  }, [serialized, limit])

  const undo = useCallback(() => {
    flush()
    if (pastRef.current.length === 0) return
    const prev = pastRef.current.pop()
    if (lastCommittedRef.current !== null) {
      futureRef.current.push(lastCommittedRef.current)
    }
    // Note: we intentionally do NOT update lastCommittedRef here.
    // The effect below will run when React re-renders with the restored
    // state, see suppressRef=true, and resync lastCommittedRef to the
    // new serialized snapshot while clearing suppressRef atomically.
    suppressRef.current = true
    try {
      restore(JSON.parse(prev))
    } catch {
      suppressRef.current = false
    }
    setVersion((v) => v + 1)
  }, [flush, restore])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return
    const next = futureRef.current.pop()
    if (lastCommittedRef.current !== null) {
      pastRef.current.push(lastCommittedRef.current)
      if (pastRef.current.length > limit) pastRef.current.shift()
    }
    suppressRef.current = true
    try {
      restore(JSON.parse(next))
    } catch {
      suppressRef.current = false
    }
    setVersion((v) => v + 1)
  }, [limit, restore])

  const clear = useCallback(() => {
    pastRef.current = []
    futureRef.current = []
    setVersion((v) => v + 1)
  }, [])

  // `version` is read here purely to re-render derived values when stacks change.
  void version

  return {
    undo,
    redo,
    clear,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    pastSize: pastRef.current.length,
    futureSize: futureRef.current.length,
  }
}
