import { useEffect, useRef, useState } from 'react'
import { archiveCharacter, renameCharacter, restoreCharacter } from '../../lib/api/characterBatches.js'
import { approveGeneratedImage, rejectGeneratedImage } from '../../lib/api/generatedImages.js'
import { queueCharacterPortfolio } from '../../lib/api/portfolio.js'
import styles from './ActorDetail.module.css'

const PROFILE_SECTIONS = [
  {
    label: 'Face',
    fields: [
      ['faceShape', 'Face shape'],
      ['eyes', 'Eyes'],
      ['eyebrows', 'Eyebrows'],
      ['nose', 'Nose'],
      ['lips', 'Lips'],
      ['jawline', 'Jawline'],
      ['cheekbones', 'Cheekbones'],
    ],
  },
  {
    label: 'Skin & Hair',
    fields: [
      ['skinTone', 'Skin tone'],
      ['skinTexture', 'Skin texture'],
      ['hairColor', 'Hair color'],
      ['hairLength', 'Length'],
      ['hairTexture', 'Texture'],
      ['hairstyle', 'Hairstyle'],
    ],
  },
  {
    label: 'Body',
    fields: [
      ['ethnicityOrRegionalLook', 'Ethnicity / look'],
      ['bodyType', 'Body type'],
      ['heightImpression', 'Height'],
      ['posture', 'Posture'],
    ],
  },
  {
    label: 'Screen presence',
    fields: [
      ['wardrobeBase', 'Wardrobe'],
      ['personalityEnergy', 'Energy'],
    ],
  },
]

function renderValue(val) {
  if (Array.isArray(val)) return val.join(', ')
  if (val !== null && typeof val === 'object') {
    const { min, max } = val
    if (min != null && max != null) return `${min}–${max}`
    return Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(', ')
  }
  return String(val ?? '—')
}

export default function ActorDetail({ character: initialCharacter, images: initialImages, onBack, onDelete, onArchive, onRestore, onOpenInCastingRoom }) {
  const [character, setCharacter] = useState(initialCharacter)
  const { id, age, genderPresentation, cinematicArchetype, distinctiveFeatures, visualKeywords, archived_at } = character
  const [displayName, setDisplayName] = useState(character.name ?? 'Unnamed')
  const [lifecycleStatus, setLifecycleStatus] = useState(character.lifecycleStatus ?? null)

  // Images state (AB4)
  const [images, setImages] = useState(initialImages)
  const [showRejected, setShowRejected] = useState(false)
  const [imageActionLoading, setImageActionLoading] = useState({})
  const [imageActionError, setImageActionError] = useState(null)

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  // Rename state (AB3)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)
  const [renameError, setRenameError] = useState(null)
  const renameInputRef = useRef(null)

  // Archive/restore state (AB3)
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState(null)

  // Re-queue state (AB6)
  const [requeueLoading, setRequeuLoading] = useState(false)
  const [requeueError, setRequeuError] = useState(null)

  const metaParts = [age, genderPresentation, cinematicArchetype].filter(Boolean)

  const visibleImages = showRejected ? images : images.filter((img) => img.approved !== false)
  const rejectedCount = images.filter((img) => img.approved === false).length

  useEffect(() => {
    if (isRenaming) renameInputRef.current?.focus()
  }, [isRenaming])

  const startRename = () => {
    setRenameValue(displayName)
    setRenameError(null)
    setIsRenaming(true)
  }

  const cancelRename = () => {
    setIsRenaming(false)
    setRenameError(null)
  }

  const commitRename = async () => {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === displayName) { cancelRename(); return }
    setRenameLoading(true)
    setRenameError(null)
    try {
      await renameCharacter(id, trimmed)
      setDisplayName(trimmed)
      setCharacter((prev) => ({ ...prev, name: trimmed }))
      setIsRenaming(false)
    } catch (err) {
      setRenameError(err.message ?? 'Rename failed')
    } finally {
      setRenameLoading(false)
    }
  }

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitRename() }
    if (e.key === 'Escape') cancelRename()
  }

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/characters?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      onDelete?.(id)
    } catch (err) {
      setDeleteError(err.message ?? 'Delete failed')
      setDeleting(false)
    }
  }

  const handleArchive = async () => {
    setArchiving(true)
    setArchiveError(null)
    try {
      await archiveCharacter(id)
      onArchive?.(id)
    } catch (err) {
      setArchiveError(err.message ?? 'Archive failed')
      setArchiving(false)
    }
  }

  const handleRestore = async () => {
    setArchiving(true)
    setArchiveError(null)
    try {
      await restoreCharacter(id)
      onRestore?.(id)
    } catch (err) {
      setArchiveError(err.message ?? 'Restore failed')
      setArchiving(false)
    }
  }

  const handleImageApprove = async (imgId) => {
    setImageActionLoading((prev) => ({ ...prev, [imgId]: true }))
    setImageActionError(null)
    try {
      await approveGeneratedImage(imgId)
      setImages((prev) => prev.map((img) => img.id === imgId ? { ...img, approved: true } : img))
    } catch (err) {
      setImageActionError(err.message ?? 'Action failed')
    } finally {
      setImageActionLoading((prev) => ({ ...prev, [imgId]: false }))
    }
  }

  const handleImageReject = async (imgId) => {
    setImageActionLoading((prev) => ({ ...prev, [imgId]: true }))
    setImageActionError(null)
    try {
      await rejectGeneratedImage(imgId)
      setImages((prev) => prev.map((img) => img.id === imgId ? { ...img, approved: false } : img))
    } catch (err) {
      setImageActionError(err.message ?? 'Action failed')
    } finally {
      setImageActionLoading((prev) => ({ ...prev, [imgId]: false }))
    }
  }

  const handleRequeue = async () => {
    setRequeuLoading(true)
    setRequeuError(null)
    try {
      await queueCharacterPortfolio({ characterId: id })
      setLifecycleStatus('portfolio_pending')
    } catch (err) {
      setRequeuError(err.message ?? 'Re-queue failed')
    } finally {
      setRequeuLoading(false)
    }
  }

  return (
    <div className={styles.detail}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          ← Back to Actor Bank
        </button>
        <div className={styles.topBarActions}>
          {onOpenInCastingRoom && (
            <button
              type="button"
              className={styles.castingRoomBtn}
              onClick={() => onOpenInCastingRoom(id)}
            >
              Open in Casting Room →
            </button>
          )}
          {archiveError && <span className={styles.actionError}>{archiveError}</span>}

          {archived_at ? (
            <button
              type="button"
              className={styles.restoreBtn}
              onClick={handleRestore}
              disabled={archiving}
            >
              {archiving ? 'Restoring…' : 'Restore'}
            </button>
          ) : (
            <button
              type="button"
              className={styles.archiveBtn}
              onClick={handleArchive}
              disabled={archiving}
            >
              {archiving ? 'Archiving…' : 'Archive'}
            </button>
          )}

          {confirmDelete ? (
            <div className={styles.confirmRow}>
              <span className={styles.confirmPrompt}>Delete {displayName}?</span>
              <button
                type="button"
                className={styles.confirmYes}
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                type="button"
                className={styles.confirmNo}
                onClick={() => { setConfirmDelete(false); setDeleteError(null) }}
                disabled={deleting}
              >
                Cancel
              </button>
              {deleteError && <span className={styles.deleteError}>{deleteError}</span>}
            </div>
          ) : (
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className={styles.hero}>
        {isRenaming ? (
          <div className={styles.renameRow}>
            <input
              ref={renameInputRef}
              className={styles.renameInput}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={commitRename}
              disabled={renameLoading}
              maxLength={120}
            />
            {renameError && <span className={styles.renameError}>{renameError}</span>}
          </div>
        ) : (
          <button type="button" className={styles.nameBtn} onClick={startRename} title="Click to rename">
            {displayName}
          </button>
        )}
        {archived_at && <span className={styles.archivedBadge}>archived</span>}
        {metaParts.length > 0 && (
          <div className={styles.herMeta}>{metaParts.join(' · ')}</div>
        )}
      </div>

      {/* AB6 — Re-queue when portfolio failed */}
      {lifecycleStatus === 'portfolio_failed' && (
        <div className={styles.requeueBanner}>
          <span className={styles.requeueMsg}>Portfolio generation failed.</span>
          <button
            type="button"
            className={styles.requeueBtn}
            onClick={handleRequeue}
            disabled={requeueLoading}
          >
            {requeueLoading ? 'Queuing…' : 'Re-queue portfolio'}
          </button>
          {requeueError && <span className={styles.requeueError}>{requeueError}</span>}
        </div>
      )}
      {lifecycleStatus === 'portfolio_pending' && (
        <div className={styles.requeueBanner}>
          <span className={styles.requeueMsg}>Portfolio generation in progress…</span>
        </div>
      )}

      {images.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Reference images
            {rejectedCount > 0 && (
              <button
                type="button"
                className={styles.showRejectedToggle}
                onClick={() => setShowRejected((v) => !v)}
              >
                {showRejected ? `Hide ${rejectedCount} discarded` : `Show ${rejectedCount} discarded`}
              </button>
            )}
          </h3>
          {imageActionError && <p className={styles.imageActionError}>{imageActionError}</p>}
          <div className={styles.imageStrip}>
            {visibleImages.map((img) => {
              const busy = imageActionLoading[img.id]
              const isApproved = img.approved === true
              const isRejected = img.approved === false
              return (
                <div
                  key={img.id}
                  className={`${styles.imageCard} ${isRejected ? styles.imageCardRejected : ''}`}
                >
                  <div className={styles.imageWrap}>
                    <img
                      src={img.imageUrl}
                      alt={img.viewType ?? 'character'}
                      loading="lazy"
                      className={styles.image}
                    />
                    {isApproved && <div className={styles.approvedBadge} aria-label="Kept">✓</div>}
                  </div>
                  <span className={styles.imageLabel}>
                    {(img.viewType ?? '').replace(/_/g, ' ')}
                  </span>
                  <div className={styles.imageActions}>
                    <button
                      type="button"
                      className={`${styles.keepBtn} ${isApproved ? styles.keepBtnActive : ''}`}
                      onClick={() => handleImageApprove(img.id)}
                      disabled={busy || isApproved}
                      title="Keep this image"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      className={`${styles.discardBtn} ${isRejected ? styles.discardBtnActive : ''}`}
                      onClick={() => handleImageReject(img.id)}
                      disabled={busy || isRejected}
                      title="Discard this image"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Character profile</h3>
        <div className={styles.profileGrid}>
          {PROFILE_SECTIONS.map(({ label, fields }) => {
            const rows = fields.filter(([key]) => character[key] != null && character[key] !== '')
            if (!rows.length) return null
            return (
              <div key={label} className={styles.profileGroup}>
                <div className={styles.groupLabel}>{label}</div>
                {rows.map(([key, display]) => (
                  <div key={key} className={styles.row}>
                    <span className={styles.rowKey}>{display}</span>
                    <span className={styles.rowVal}>{renderValue(character[key])}</span>
                  </div>
                ))}
              </div>
            )
          })}

          {distinctiveFeatures?.length > 0 && (
            <div className={styles.profileGroup}>
              <div className={styles.groupLabel}>Distinctive features</div>
              <div className={styles.row}>
                <span className={styles.rowVal}>{distinctiveFeatures.join(' · ')}</span>
              </div>
            </div>
          )}

          {visualKeywords?.length > 0 && (
            <div className={styles.profileGroup}>
              <div className={styles.groupLabel}>Visual keywords</div>
              <div className={styles.chips}>
                {visualKeywords.map((kw) => (
                  <span key={kw} className={styles.chip}>{kw}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
