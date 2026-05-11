import { useEffect, useState } from 'react'
import {
  generateContinuityQa,
  getContinuityQaScoringSheet,
  getMvpDoneGateReadiness,
  submitContinuityQaScores,
} from '../lib/api/continuityQa.js'
import styles from './EntityContinuityQaPanel.module.css'

const AXES = ['face', 'body', 'wardrobe']

function withDefaultScores(sheet) {
  const scenes = Array.isArray(sheet?.scenes) ? sheet.scenes : []
  return {
    ...sheet,
    scenes: scenes.map((scene) => ({
      ...scene,
      seedHidden: true,
      scores: {
        face: scene?.scores?.face ?? '',
        body: scene?.scores?.body ?? '',
        wardrobe: scene?.scores?.wardrobe ?? '',
      },
    })),
  }
}

export default function EntityContinuityQaPanel({ entityId, entityType }) {
  const [readiness, setReadiness] = useState(null)
  const [scoringSheet, setScoringSheet] = useState(null)
  const [decision, setDecision] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!entityId || entityType !== 'character') {
      setReadiness(null)
      setScoringSheet(null)
      setDecision(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    getMvpDoneGateReadiness(entityId)
      .then((result) => {
        if (cancelled) return
        setReadiness(result)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message || 'Failed to load MVP Done gate readiness')
        setReadiness(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [entityId, entityType])

  const handleLoadScoringSheet = async () => {
    if (!entityId) return
    setError('')
    setStatus('Loading scoring sheet…')
    try {
      const result = await getContinuityQaScoringSheet(entityId)
      setScoringSheet(withDefaultScores(result))
      setDecision(null)
      setStatus('Score each scene blind to seed (1–5 per axis).')
    } catch (err) {
      setError(err?.message || 'Failed to load scoring sheet')
      setStatus('')
    }
  }

  const handleGenerate = async () => {
    if (!entityId) return
    setError('')
    setStatus('Queueing five continuity QA scenes…')
    try {
      const result = await generateContinuityQa(entityId, {})
      setStatus(`Queued ${result.sceneCount} scenes. Load the scoring sheet after reviewing outputs.`)
    } catch (err) {
      setError(err?.message || 'Failed to queue continuity QA generations')
      setStatus('')
    }
  }

  const handleScoreChange = (sceneId, axis, value) => {
    setScoringSheet((current) => ({
      ...current,
      scenes: current.scenes.map((scene) => (
        scene.id === sceneId
          ? { ...scene, scores: { ...scene.scores, [axis]: value } }
          : scene
      )),
    }))
  }

  const handleSubmitScores = async () => {
    if (!entityId || !scoringSheet) return
    setError('')
    setStatus('Submitting reviewer scores…')
    try {
      const payload = {
        ...scoringSheet,
        scenes: scoringSheet.scenes.map((scene) => ({
          ...scene,
          seedHidden: true,
          scores: {
            face: Number(scene.scores.face),
            body: Number(scene.scores.body),
            wardrobe: Number(scene.scores.wardrobe),
          },
        })),
      }
      const result = await submitContinuityQaScores(entityId, payload)
      setDecision(result)
      setStatus(result.outcome === 'accepted'
        ? 'MVP Done gate accepted.'
        : 'MVP Done gate failed. Review recommendations below.')
    } catch (err) {
      setError(err?.message || 'Failed to submit reviewer scores')
      setStatus('')
    }
  }

  if (!entityId || entityType !== 'character') return null

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>MVP Done gate</h3>
          <p className={styles.subtitle}>
            Section 4 acceptance: one character, one environment context, five scene generations, and reviewer scores ≥4/5 on face, body, and wardrobe.
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={handleGenerate} disabled={loading || readiness?.ready === false}>
            Queue 5 scenes
          </button>
          <button type="button" onClick={handleLoadScoringSheet} disabled={loading}>
            Load scoring sheet
          </button>
          <button type="button" onClick={handleSubmitScores} disabled={loading || !scoringSheet}>
            Submit scores
          </button>
        </div>
      </div>

      {readiness?.checks?.length ? (
        <ul className={styles.checklist}>
          {readiness.checks.map((check) => (
            <li
              key={check.id}
              className={`${styles.checkItem} ${check.met ? styles.checkItemMet : ''}`}
            >
              <span className={styles.checkMark}>{check.met ? '✓' : '○'}</span>
              <span>{check.label}{check.detail != null ? ` (${check.detail})` : ''}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {scoringSheet?.scenes?.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Scene</th>
                {AXES.map((axis) => <th key={axis}>{axis}</th>)}
              </tr>
            </thead>
            <tbody>
              {scoringSheet.scenes.map((scene) => (
                <tr key={scene.id}>
                  <td>{scene.environment}</td>
                  {AXES.map((axis) => (
                    <td key={`${scene.id}-${axis}`}>
                      <input
                        className={styles.scoreInput}
                        type="number"
                        min="1"
                        max="5"
                        value={scene.scores?.[axis] ?? ''}
                        onChange={(event) => handleScoreChange(scene.id, axis, event.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {status ? <p className={styles.status}>{status}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {decision ? (
        <p className={decision.outcome === 'accepted' ? styles.resultAccepted : styles.resultFailed}>
          {decision.outcome === 'accepted'
            ? `Accepted (face ${decision.averages.face.toFixed(2)}, body ${decision.averages.body.toFixed(2)}, wardrobe ${decision.averages.wardrobe.toFixed(2)}).`
            : `Failed (face ${decision.averages.face.toFixed(2)}, body ${decision.averages.body.toFixed(2)}, wardrobe ${decision.averages.wardrobe.toFixed(2)}).`}
        </p>
      ) : null}
    </div>
  )
}
