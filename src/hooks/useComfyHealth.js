import { useEffect, useState } from 'react'
import { getComfyStatus } from '../lib/api/comfy.js'

export function useComfyHealth({
  pollWhenReadyMs = 30000,
  pollWhenUnavailableMs = 5000,
} = {}) {
  const [comfy, setComfy] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let timer = null
    let cancelled = false

    async function check() {
      if (cancelled) return
      try {
        const result = await getComfyStatus()
        const next = result?.comfy || { available: false, baseUrl: null }
        if (!cancelled) {
          setComfy(next)
          setError('')
        }
        timer = setTimeout(check, next.available ? pollWhenReadyMs : pollWhenUnavailableMs)
      } catch (err) {
        if (!cancelled) {
          setComfy({ available: false, baseUrl: null })
          setError(err?.message || 'Comfy check failed')
        }
        timer = setTimeout(check, pollWhenUnavailableMs)
      }
    }

    check()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [pollWhenReadyMs, pollWhenUnavailableMs])

  return {
    comfy,
    comfyError: error,
    comfyReady: comfy?.available === true,
  }
}
