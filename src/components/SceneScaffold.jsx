import { useState, useMemo, useCallback } from 'react'
import {
  SCAFFOLD_BASE_ACTIONS,
  SCAFFOLD_ENGINES,
  SCAFFOLD_SPACES,
  SCAFFOLD_VISUAL,
  SCAFFOLD_SILENCE,
  buildSceneScaffold,
} from '../utils/sceneScaffold.js'
import styles from './SceneScaffold.module.css'

const GENDERS = ['man', 'woman', 'person']
const AGES = ['child', 'teen', '20s', '30s', '40s', '50s', '60s', 'elderly']

export default function SceneScaffold({ onApply, charCount = 1, chars = [] }) {
  const [baseId, setBaseId] = useState(SCAFFOLD_BASE_ACTIONS[0].id)
  const [engineId, setEngineId] = useState(SCAFFOLD_ENGINES[0].id)
  const [spaceId, setSpaceId] = useState(SCAFFOLD_SPACES[0].id)
  const [visualId, setVisualId] = useState(SCAFFOLD_VISUAL[0].id)
  const [silenceId, setSilenceId] = useState(SCAFFOLD_SILENCE[0].id)
  const [fig0, setFig0] = useState({ g: 'man', a: '40s' })
  const [fig1, setFig1] = useState({ g: 'woman', a: '30s' })
  const [syncFiguresToDirector, setSyncFiguresToDirector] = useState(true)

  const figurePair = useMemo(() => [fig0, fig1], [fig0, fig1])

  const preview = useMemo(
    () => buildSceneScaffold(
      { baseId, engineId, spaceId, visualId, silenceId },
      figurePair,
    ).paragraph,
    [baseId, engineId, spaceId, visualId, silenceId, figurePair],
  )

  const matchDirector = useCallback(() => {
    const c0 = chars?.[0] ?? { g: 'man', a: '40s' }
    const c1 = charCount >= 2 && chars?.[1]
      ? chars[1]
      : { g: 'person', a: '30s' }
    setFig0({ g: c0.g ?? 'person', a: c0.a ?? '30s' })
    setFig1({ g: c1.g ?? 'person', a: c1.a ?? '30s' })
  }, [chars, charCount])

  const handleApply = () => {
    const { paragraph, chips } = buildSceneScaffold(
      { baseId, engineId, spaceId, visualId, silenceId },
      figurePair,
    )
    const third = chars?.[2] ?? { g: 'person', a: '30s' }
    onApply?.({
      paragraph,
      chips,
      figureSync: syncFiguresToDirector
        ? {
            chars: [
              { g: fig0.g, a: fig0.a },
              { g: fig1.g, a: fig1.a },
              { g: third.g ?? 'person', a: third.a ?? '30s' },
            ],
          }
        : undefined,
    })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div className={styles.title}>Scene scaffold (five dimensions)</div>
        <p className={styles.hint}>
          Base action, emotional engine, space, visual treatment, silence/dialogue bias → concrete scene line + suggested chips.
          Two figures: set gender/age below; names use the same vocabulary as Director. Apply can sync those two slots to the Director panel (third character preserved).
        </p>
      </div>
      <div className={styles.body}>
        <div className={styles.figureBlock}>
          <div className={styles.figureHead}>
            <span className={styles.figureTitle}>Figures (two)</span>
            <button type="button" className={styles.matchBtn} onClick={matchDirector}>
              Match director characters
            </button>
          </div>
          <div className={styles.figureGrid}>
            <div className={styles.figureCol}>
              <span className={styles.figureLabel}>Character 1</span>
              <div className={styles.figureRow}>
                <select
                  className={styles.select}
                  value={fig0.g}
                  onChange={(e) => setFig0((f) => ({ ...f, g: e.target.value }))}
                  aria-label="Character 1 gender"
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <select
                  className={styles.select}
                  value={fig0.a}
                  onChange={(e) => setFig0((f) => ({ ...f, a: e.target.value }))}
                  aria-label="Character 1 age"
                >
                  {AGES.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.figureCol}>
              <span className={styles.figureLabel}>Character 2</span>
              <div className={styles.figureRow}>
                <select
                  className={styles.select}
                  value={fig1.g}
                  onChange={(e) => setFig1((f) => ({ ...f, g: e.target.value }))}
                  aria-label="Character 2 gender"
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <select
                  className={styles.select}
                  value={fig1.a}
                  onChange={(e) => setFig1((f) => ({ ...f, a: e.target.value }))}
                  aria-label="Character 2 age"
                >
                  {AGES.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <label className={styles.syncToggle}>
            <input
              type="checkbox"
              checked={syncFiguresToDirector}
              onChange={(e) => setSyncFiguresToDirector(e.target.checked)}
            />
            <span>On Apply, sync these two figures to Director (2 chars) and clear scenario</span>
          </label>
        </div>

        <div className={styles.grid}>
          <div className={styles.field}>
            <label htmlFor="scaffold-base">Base action</label>
            <select id="scaffold-base" className={styles.select} value={baseId} onChange={(e) => setBaseId(e.target.value)}>
              {SCAFFOLD_BASE_ACTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="scaffold-engine">Hidden emotional engine</label>
            <select id="scaffold-engine" className={styles.select} value={engineId} onChange={(e) => setEngineId(e.target.value)}>
              {SCAFFOLD_ENGINES.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="scaffold-space">Space</label>
            <select id="scaffold-space" className={styles.select} value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
              {SCAFFOLD_SPACES.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="scaffold-visual">Visual treatment</label>
            <select id="scaffold-visual" className={styles.select} value={visualId} onChange={(e) => setVisualId(e.target.value)}>
              {SCAFFOLD_VISUAL.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="scaffold-silence">Silence / dialogue ratio (bias)</label>
            <select id="scaffold-silence" className={styles.select} value={silenceId} onChange={(e) => setSilenceId(e.target.value)}>
              {SCAFFOLD_SILENCE.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.applyBtn} onClick={handleApply}>
            Apply to scene + chips
          </button>
        </div>
        <p className={styles.preview} title={preview}>Preview: {preview}</p>
      </div>
    </div>
  )
}
