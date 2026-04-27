import { useEffect, useMemo, useState } from 'react'
import {
  canUseEmbeddedRuntime,
  deleteModel,
  getEmbeddedStatus,
  listAvailableModels,
  listInstalledModels,
  setDefaultModel,
  startEmbeddedSidecar,
  startModelDownload,
  stopEmbeddedSidecar,
  verifyModel,
} from '../lib/embeddedRuntime.js'
import styles from './EmbeddedSetup.module.css'

export default function EmbeddedSetup({ open, onClose, onStatusChange }) {
  const [available, setAvailable] = useState([])
  const [installed, setInstalled] = useState([])
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectedModel, setSelectedModel] = useState('qwen2.5-3b-instruct-q4_k_m')
  const [preflight, setPreflight] = useState({ ramOk: true, diskOk: true, ramGb: null, freeGb: null })

  const installedSet = useMemo(() => new Set(installed.map((m) => m.id)), [installed])

  async function refresh() {
    if (!canUseEmbeddedRuntime()) return
    const [a, i, s] = await Promise.all([
      listAvailableModels(),
      listInstalledModels(),
      getEmbeddedStatus(),
    ])
    setAvailable(a)
    setInstalled(i)
    setStatus(s)
    onStatusChange?.(s)

    const selected = a.find((m) => m.id === selectedModel) || a[0]
    const ramGb = typeof navigator !== 'undefined' && navigator.deviceMemory ? Number(navigator.deviceMemory) : null
    let freeGb = null
    if (navigator?.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      freeGb = typeof estimate?.quota === 'number' && typeof estimate?.usage === 'number'
        ? (estimate.quota - estimate.usage) / 1024 / 1024 / 1024
        : null
    }
    setPreflight({
      ramGb,
      freeGb,
      ramOk: ramGb == null ? true : ramGb >= (selected?.min_ram_gb || 8),
      diskOk: freeGb == null ? true : freeGb >= ((selected?.size || 0) / 1024 / 1024 / 1024 + 0.5),
    })
  }

  useEffect(() => {
    if (!open) return
    setError('')
    refresh().catch((e) => setError(e.message || 'Failed to load embedded status'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  if (!canUseEmbeddedRuntime()) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <h3>Embedded runtime unavailable</h3>
          <p>This setup is only available in the desktop Tauri build.</p>
          <div className={styles.actions}>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    )
  }

  const handleDownload = async () => {
    if (!preflight.diskOk) {
      setError('Not enough free disk for model download')
      return
    }
    setBusy(true)
    setError('')
    try {
      await startModelDownload(selectedModel)
      const verify = await verifyModel(selectedModel)
      if (!verify.ok) {
        throw new Error('Downloaded model checksum verification failed')
      }
      await setDefaultModel(selectedModel)
      await refresh()
    } catch (e) {
      setError(e.message || 'Download failed')
    } finally {
      setBusy(false)
    }
  }

  const handleStart = async () => {
    const installedModel = installed.find((m) => m.id === selectedModel)
    if (!installedModel) return
    setBusy(true)
    setError('')
    try {
      const s = await startEmbeddedSidecar({
        modelPath: installedModel.path,
        port: 43211,
        threads: 6,
        ctxSize: 2048,
        nGpuLayers: 0,
      })
      setStatus(s)
      onStatusChange?.(s)
    } catch (e) {
      setError(e.message || 'Failed to start sidecar')
    } finally {
      setBusy(false)
    }
  }

  const handleStop = async () => {
    setBusy(true)
    setError('')
    try {
      const s = await stopEmbeddedSidecar()
      setStatus(s)
      onStatusChange?.(s)
    } catch (e) {
      setError(e.message || 'Failed to stop sidecar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3>Embedded model setup</h3>
        <p className={styles.meta}>
          Install and run a local GGUF model with built-in `llama-server`.
        </p>

        <label className={styles.row}>
          <span>Model</span>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} disabled={busy}>
            {available.map((model) => (
              <option key={model.id} value={model.id}>
                {model.display_name} ({Math.round((model.size / 1024 / 1024 / 1024) * 10) / 10} GB)
              </option>
            ))}
          </select>
        </label>

        <p className={styles.status}>
          Sidecar: {status?.running ? `running on :${status.port}` : 'stopped'}
        </p>
        <p className={styles.status}>
          Installed: {installedSet.has(selectedModel) ? 'yes' : 'no'}
        </p>
        <p className={styles.status}>
          RAM preflight: {preflight.ramOk ? 'ok' : `low (${preflight.ramGb ?? '?'} GB detected)`}
        </p>
        <p className={styles.status}>
          Disk preflight: {preflight.diskOk ? 'ok' : `insufficient (${Math.max(0, Math.round((preflight.freeGb ?? 0) * 10) / 10)} GB free)`}
        </p>
        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          <button onClick={handleDownload} disabled={busy || installedSet.has(selectedModel)}>
            {busy ? 'Working...' : installedSet.has(selectedModel) ? 'Installed' : 'Download model'}
          </button>
          <button onClick={handleStart} disabled={busy || !installedSet.has(selectedModel)}>
            Start sidecar
          </button>
          <button onClick={handleStop} disabled={busy || !status?.running}>
            Stop
          </button>
          <button
            onClick={async () => {
              setBusy(true)
              try {
                await deleteModel(selectedModel)
                await refresh()
              } catch (e) {
                setError(e.message || 'Delete failed')
              } finally {
                setBusy(false)
              }
            }}
            disabled={busy || !installedSet.has(selectedModel)}
          >
            Delete model
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
