import { useCallback, useEffect, useRef, useState } from 'react'
import {
  generateReferenceImageFromStage5,
  listEntityAnchors,
  setPrimaryEntityAnchor,
  uploadEntityReferenceAnchor,
  waitForPrimaryReferenceAnchor,
} from '../lib/api/entityAnchors.js'
import styles from './VisualAnchorPicker.module.css'

function anchorImageSrc(anchor) {
  if (anchor?.type !== 'reference_image') return null
  if (anchor?.payloadEncoding === 'base64' && typeof anchor.payload === 'string') {
    return `data:image/png;base64,${anchor.payload}`
  }
  return null
}

export default function VisualAnchorPicker({ entityId }) {
  const [anchors, setAnchors] = useState([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [settingPrimaryId, setSettingPrimaryId] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const uploadInputRef = useRef(null)

  const loadAnchors = useCallback(async () => {
    if (!entityId) {
      setAnchors([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await listEntityAnchors(entityId)
      setAnchors(Array.isArray(result?.items) ? result.items : [])
    } catch (err) {
      setError(err?.message || 'Failed to load anchors')
      setAnchors([])
    } finally {
      setLoading(false)
    }
  }, [entityId])

  useEffect(() => {
    void loadAnchors()
  }, [loadAnchors])

  const handleGenerate = async () => {
    if (!entityId || generating) return
    setGenerating(true)
    setError('')
    setStatus('Generating reference portrait from Stage 5 descriptor…')
    try {
      const result = await generateReferenceImageFromStage5(entityId)
      if (!result?.anchor?.isPrimary) {
        await waitForPrimaryReferenceAnchor(entityId, { attempts: 3, intervalMs: 500 })
      }
      await loadAnchors()
      setStatus('Primary reference anchor updated.')
    } catch (err) {
      setError(err?.message || 'Reference generation failed')
      setStatus('')
    } finally {
      setGenerating(false)
    }
  }

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!entityId || !file || uploading) return
    setUploading(true)
    setError('')
    setStatus('Uploading reference image…')
    try {
      await uploadEntityReferenceAnchor(entityId, file)
      await loadAnchors()
      setStatus('Primary reference anchor updated from upload.')
    } catch (err) {
      setError(err?.message || 'Reference upload failed')
      setStatus('')
    } finally {
      setUploading(false)
    }
  }

  const handleSetPrimary = async (anchorId) => {
    if (!entityId || settingPrimaryId) return
    setSettingPrimaryId(anchorId)
    setError('')
    try {
      await setPrimaryEntityAnchor(entityId, anchorId)
      await loadAnchors()
    } catch (err) {
      setError(err?.message || 'Failed to set primary anchor')
    } finally {
      setSettingPrimaryId('')
    }
  }

  if (!entityId) {
    return (
      <div className={styles.wrap}>
        <p className={styles.empty}>Select an entity to manage visual anchors.</p>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.title}>Visual anchors</span>
        <div className={styles.actions}>
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            className={styles.uploadInput}
            data-testid="T_F_ANCHOR_UPLOAD"
            onChange={handleUpload}
          />
          <button
            type="button"
            className={styles.generateBtn}
            onClick={() => uploadInputRef.current?.click()}
            disabled={uploading || loading || generating}
          >
            {uploading ? 'Uploading…' : 'Upload reference image'}
          </button>
          <button
            type="button"
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={generating || loading || uploading}
          >
            {generating ? 'Generating…' : 'Generate from S5 descriptor'}
          </button>
        </div>
      </div>
      {status ? <p className={styles.status}>{status}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.status}>Loading anchors…</p> : null}
      {!loading && anchors.length === 0 ? (
        <p className={styles.empty}>No anchors yet. Generate from the Stage 5 descriptor or upload a reference image.</p>
      ) : null}
      {anchors.length > 0 ? (
        <div className={styles.grid}>
          {anchors.map((anchor) => {
            const imageSrc = anchorImageSrc(anchor)
            return (
              <div
                key={anchor.id}
                className={`${styles.card} ${anchor.isPrimary ? styles.cardPrimary : ''}`}
              >
                {imageSrc ? (
                  <img src={imageSrc} alt={`${anchor.type} anchor`} className={styles.thumb} />
                ) : (
                  <div className={styles.thumb} />
                )}
                <div className={styles.meta}>
                  <span className={styles.type}>{anchor.type}</span>
                  <button
                    type="button"
                    className={`${styles.primaryBtn} ${anchor.isPrimary ? styles.primaryBtnActive : ''}`}
                    onClick={() => handleSetPrimary(anchor.id)}
                    disabled={anchor.isPrimary || settingPrimaryId === anchor.id}
                    aria-label={anchor.isPrimary ? 'Primary anchor' : 'Set as primary anchor'}
                    title={anchor.isPrimary ? 'Primary anchor' : 'Set as primary'}
                  >
                    {settingPrimaryId === anchor.id ? '…' : anchor.isPrimary ? '★' : '☆'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
