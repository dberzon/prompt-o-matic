import { useState, useCallback } from 'react'
import { assemblePrompt } from '../utils/assembler.js'
import { useSectionState } from '../hooks/useSectionState.js'
import styles from './BatchExplorer.module.css'

export default function BatchExplorer({ scenario, chips }) {
  const [lines, setLines] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useSectionState('batch-explorer', false)

  const runBatch = useCallback(() => {
    const scenes = lines
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (scenes.length === 0) {
      setResults([])
      return
    }
    const next = scenes.map((scene, i) => {
      const parts = assemblePrompt({ scene, scenario, chips })
      return { id: i, scene, text: parts.join(', ') }
    })
    setResults(next)
  }, [lines, scenario, chips])

  const copyOne = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
  }

  const copyAll = async () => {
    const blob = results.map((r) => `--- ${r.scene}\n${r.text}`).join('\n\n')
    try {
      await navigator.clipboard.writeText(blob)
    } catch {
      /* ignore */
    }
  }

  const downloadBatchTxt = () => {
    if (results.length === 0) return
    const body = results.map((r) => `--- ${r.scene}\n${r.text}`).join('\n\n')
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `qpb-batch-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.toggle} onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide batch mode' : 'Batch mode (scene lines)'}
      </button>
      {open && (
        <div className={styles.body}>
          <p className={styles.hint}>
            One scene variant per line. Same director, scenario, and chips apply to each; only the scene text changes.
          </p>
          <textarea
            className={styles.textarea}
            value={lines}
            onChange={(e) => setLines(e.target.value)}
            placeholder={'village outskirts, late autumn\nindustrial yard, night rain\nempty corridor, single lamp'}
            rows={5}
            spellCheck={false}
          />
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={runBatch}>
              Generate prompts
            </button>
            {results.length > 0 && (
              <>
                <button type="button" className={styles.btnSecondary} onClick={copyAll}>
                  Copy all
                </button>
                <button type="button" className={styles.btnSecondary} onClick={downloadBatchTxt}>
                  Download .txt
                </button>
              </>
            )}
          </div>
          {results.length > 0 && (
            <ul className={styles.list}>
              {results.map((r) => (
                <li key={r.id} className={styles.item}>
                  <p className={styles.sceneLabel}>{r.scene}</p>
                  <p className={styles.preview}>{r.text}</p>
                  <button type="button" className={styles.copyBtn} onClick={() => copyOne(r.text)}>
                    Copy
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
