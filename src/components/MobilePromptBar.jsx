import { useState, useCallback } from 'react'
import { NEGATIVE_PROMPT } from '../data/chips.js'
import styles from './MobilePromptBar.module.css'

export default function MobilePromptBar({ displayText, hasContent }) {
  const [showModal, setShowModal] = useState(false)
  const [copyState, setCopyState] = useState('idle')

  const charCount = displayText?.length ?? 0

  const handleCopy = useCallback(async () => {
    if (!displayText) return
    try {
      await navigator.clipboard.writeText(displayText)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('error')
      setTimeout(() => setCopyState('idle'), 2000)
    }
  }, [displayText])

  const handleCopyNegative = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(NEGATIVE_PROMPT)
    } catch {
      // Silent fail
    }
  }, [])

  if (!hasContent) return null

  return (
    <>
      <div className={styles.bar}>
        <div className={styles.info}>
          <span className={styles.label}>Prompt ready</span>
          <span className={styles.count}>{charCount} chars</span>
        </div>
        <button
          className={styles.btn}
          onClick={() => setShowModal(true)}
          disabled={!hasContent}
        >
          View & Copy
        </button>
      </div>

      {showModal && (
        <div className={styles.modal} onClick={() => setShowModal(false)}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHeader}>
              <div className={styles.headerLeft}>
                <span className={styles.sheetTitle}>Prompt</span>
                <span className={styles.sheetCount}>{charCount} chars</span>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className={styles.promptBox}>
              {displayText}
            </div>

            <div className={styles.actions}>
              <button
                className={`${styles.actionBtn} ${styles.actionPrimary} ${copyState === 'copied' ? styles.copied : ''}`}
                onClick={handleCopy}
              >
                {copyState === 'copied' ? '✓ Copied' : copyState === 'error' ? 'Failed' : 'Copy Prompt'}
              </button>
              <button
                className={styles.actionBtn}
                onClick={handleCopyNegative}
              >
                Copy Negative
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
