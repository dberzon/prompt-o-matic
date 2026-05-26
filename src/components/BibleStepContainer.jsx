import { useCallback, useState } from 'react'
import BibleEditor from '../features/bible/BibleEditor.jsx'
import VisualAnchorPicker from './VisualAnchorPicker.jsx'
import { liftEntityFromBankEntry } from '../lib/api/entities.js'
import styles from './BibleStepContainer.module.css'

/**
 * @param {{
 *   activeCharId: string | null,
 *   activeEntityId: string | null,
 *   setActiveEntityId: (id: string | null) => void,
 *   activeBankSlug: string | null,
 *   setActiveStep: (step: number) => void,
 *   onNext: () => void,
 *   onPrev: () => void,
 * }} props
 */
export default function BibleStepContainer({
  activeCharId,
  activeEntityId,
  setActiveEntityId,
  activeBankSlug,
  setActiveStep,
  onNext,
  onPrev,
}) {
  const [lifting, setLifting] = useState(false)
  const [liftError, setLiftError] = useState('')

  const handleLift = useCallback(async () => {
    if (!activeCharId) return

    setLifting(true)
    setLiftError('')
    let bankEntrySlug = activeBankSlug ?? null
    let name = bankEntrySlug ?? activeCharId
    let description = ''
    try {
      const res = await fetch(`/api/characters?id=${encodeURIComponent(activeCharId)}`)
      const data = await res.json()
      if (res.ok && data?.item) {
        bankEntrySlug = bankEntrySlug ?? data.item.slug ?? null
        name = data.item.name || name
        description = data.item.rawDescription || data.item.description || ''
      }
    } catch {
      /* fall through to the explicit slug validation below */
    }

    try {
      if (!bankEntrySlug) {
        throw new Error('Selected character has no bank slug to lift')
      }
      const result = await liftEntityFromBankEntry({
        slug: bankEntrySlug,
        name,
        description,
        optimizedDescription: '',
      })
      const entityId = result?.entity?.id
      if (!entityId) throw new Error('Entity lift failed')
      setActiveEntityId(entityId)
    } catch (err) {
      setLiftError(err?.message || 'Lift failed')
    } finally {
      setLifting(false)
    }
  }, [activeBankSlug, activeCharId, setActiveEntityId])

  if (!activeCharId) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>
          <p>Select a character in Step 1 first.</p>
          <button type="button" className={styles.linkBtn} onClick={() => setActiveStep(1)}>
            Go to Casting
          </button>
        </div>
        <StepFooter onPrev={onPrev} onNext={onNext} nextDisabled />
      </div>
    )
  }

  if (!activeEntityId) {
    return (
      <div className={styles.root}>
        <div className={styles.liftPanel}>
          <h2 className={styles.liftTitle}>Bible context</h2>
          <p className={styles.liftHint}>
            Lift this character from the Actor Bank into an entity before editing the bible and visual anchor.
          </p>
          {liftError ? <p className={styles.liftError}>{liftError}</p> : null}
          <button
            type="button"
            className={styles.liftBtn}
            disabled={lifting}
            onClick={handleLift}
          >
            {lifting ? 'Lifting…' : 'Lift to Bible Context'}
          </button>
        </div>
        <StepFooter onPrev={onPrev} onNext={onNext} nextDisabled />
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.split}>
        <div className={styles.editorPane}>
          <BibleEditor entityId={activeEntityId} />
        </div>
        <div className={styles.anchorPane}>
          <VisualAnchorPicker entityId={activeEntityId} />
        </div>
      </div>
      <StepFooter onPrev={onPrev} onNext={onNext} />
    </div>
  )
}

function StepFooter({ onPrev, onNext, nextDisabled = false }) {
  return (
    <div className={styles.footer}>
      <button type="button" className={styles.navBtn} onClick={onPrev}>
        Previous Step
      </button>
      <button
        type="button"
        className={styles.nextBtn}
        disabled={nextDisabled}
        onClick={onNext}
      >
        Next Step
      </button>
    </div>
  )
}
