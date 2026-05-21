import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useComfyHealth } from '../hooks/useComfyHealth.js'

const EmbeddedHealthContext = createContext(null)

/** @param {{ children: import('react').ReactNode }} props */
export function EmbeddedHealthProvider({ children }) {
  const { comfy: comfyStatus, comfyError, comfyReady } = useComfyHealth()
  const [embeddedStatus, setEmbeddedStatus] = useState(null)
  const [sseLogBuffer] = useState(() => [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.__qpb = window.__qpb || {}
    window.__qpb.embedded = {
      port: embeddedStatus?.port ?? null,
      secret: embeddedStatus?.secret ?? null,
      running: Boolean(embeddedStatus?.running),
    }
  }, [embeddedStatus])

  const value = useMemo(
    () => ({
      comfyStatus,
      comfyError,
      comfyReady,
      embeddedStatus,
      setEmbeddedStatus,
      sseLogBuffer,
    }),
    [comfyStatus, comfyError, comfyReady, embeddedStatus, sseLogBuffer],
  )

  return (
    <EmbeddedHealthContext.Provider value={value}>
      {children}
    </EmbeddedHealthContext.Provider>
  )
}

export function useEmbeddedHealth() {
  const ctx = useContext(EmbeddedHealthContext)
  if (!ctx) {
    throw new Error('useEmbeddedHealth must be used within an EmbeddedHealthProvider')
  }
  return ctx
}
