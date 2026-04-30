import { useState, useMemo, useCallback } from 'react'
import {
  DECK_CATEGORIES,
  GROUP_ORDER,
  GROUP_LABELS,
  PRESET_DRAWS,
  DIRECTOR_DECK_MAP,
  CAMERA_TO_SHOT,
  LIGHTING_TO_CHIP,
  COLOR_TO_CHIP,
  LOCATION_TO_ENV,
  randomDraw,
  getCard,
} from '../data/sceneDeck.js'
import { useSectionState } from '../hooks/useSectionState.js'
import styles from './SceneDeck.module.css'

function RerollIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13.5 2.5A6.5 6.5 0 1 0 14.5 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <polyline points="11,0 14,3 11,6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function DiceIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="6.5" cy="6.5" r="1.2" fill="currentColor"/>
      <circle cx="13.5" cy="6.5" r="1.2" fill="currentColor"/>
      <circle cx="10" cy="10" r="1.2" fill="currentColor"/>
      <circle cx="6.5" cy="13.5" r="1.2" fill="currentColor"/>
      <circle cx="13.5" cy="13.5" r="1.2" fill="currentColor"/>
    </svg>
  )
}

function CategoryRow({ categoryId, index, onReroll, onCycle }) {
  const cat = DECK_CATEGORIES[categoryId]
  const card = cat.cards[index] ?? ''
  const total = cat.cards.length

  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{cat.label}</span>
      <button
        type="button"
        className={styles.cardBtn}
        onClick={onCycle}
        title={`${index + 1} / ${total} — click to cycle`}
      >
        {card}
        <span className={styles.cardCount}>{index + 1}/{total}</span>
      </button>
      <button
        type="button"
        className={styles.rerollBtn}
        onClick={onReroll}
        title="Re-roll this card"
        aria-label={`Re-roll ${cat.label}`}
      >
        <RerollIcon />
      </button>
    </div>
  )
}

export default function SceneDeck({ onApply, selectedDir }) {
  const [open, setOpen] = useSectionState('scene-deck', false)
  const [draw, setDraw] = useState(() => randomDraw())
  const [applyScene, setApplyScene] = useState(true)
  const [applyBeat, setApplyBeat] = useState(true)
  const [applyDirector, setApplyDirector] = useState(true)
  const [applyChips, setApplyChips] = useState(true)
  const [activePreset, setActivePreset] = useState(null)

  const rerollSingle = useCallback((categoryId) => {
    const len = DECK_CATEGORIES[categoryId].cards.length
    setDraw((prev) => ({
      ...prev,
      [categoryId]: Math.floor(Math.random() * len),
    }))
    setActivePreset(null)
  }, [])

  const cycleSingle = useCallback((categoryId) => {
    const len = DECK_CATEGORIES[categoryId].cards.length
    setDraw((prev) => ({
      ...prev,
      [categoryId]: (prev[categoryId] + 1) % len,
    }))
    setActivePreset(null)
  }, [])

  const drawAll = useCallback(() => {
    setDraw(randomDraw())
    setActivePreset(null)
  }, [])

  const applyPreset = useCallback((preset) => {
    setDraw({ ...preset.draw })
    setActivePreset(preset.label)
  }, [])

  // Build formula sentence from current draw
  const formula = useMemo(() => {
    const rel = getCard('relationship', draw.relationship)
    const act = getCard('action', draw.action)
    const loc = getCard('location', draw.location)
    const atm = getCard('atmosphere', draw.atmosphere)
    const prp = getCard('prop', draw.prop)
    const eng = getCard('engine', draw.engine)
    const dir = getCard('director', draw.director)
    const cam = getCard('camera', draw.camera)
    const dis = getCard('disturbance', draw.disturbance)
    const end = getCard('ending', draw.ending)
    return `Two characters (${rel.toLowerCase()}) are ${act.toLowerCase()} in ${loc.toLowerCase()}, under ${atm.toLowerCase()}, with ${prp.toLowerCase()}. The emotional engine is ${eng.toLowerCase()}. Shot in the style of ${dir}: ${cam.toLowerCase()}. The scene is disrupted when ${dis.toLowerCase()}. It ends: ${end.toLowerCase()}.`
  }, [draw])

  // Build scene text (for scene input)
  const sceneText = useMemo(() => {
    const rel = getCard('relationship', draw.relationship)
    const act = getCard('action', draw.action)
    const loc = getCard('location', draw.location)
    const atm = getCard('atmosphere', draw.atmosphere)
    const prp = getCard('prop', draw.prop)
    const ges = getCard('gesture', draw.gesture)
    return `${rel.toLowerCase()}, ${act.toLowerCase()}, ${loc.toLowerCase()}, ${atm.toLowerCase()}, with ${prp.toLowerCase()}, ${ges.toLowerCase()}`
  }, [draw])

  // Build narrative beat
  const narrativeBeat = useMemo(() => {
    const eng = getCard('engine', draw.engine)
    const blk = getCard('blocking', draw.blocking)
    const dis = getCard('disturbance', draw.disturbance)
    const end = getCard('ending', draw.ending)
    const snd = getCard('sound', draw.sound)
    return `Emotional engine: ${eng}. Blocking: ${blk}. Sound: ${snd}. Disturbance: ${dis}. Ending: ${end}.`
  }, [draw])

  // Build chip patches
  const chipPatch = useMemo(() => {
    const patch = {}
    const camCard = getCard('camera', draw.camera)
    const shotVal = CAMERA_TO_SHOT[camCard]
    if (shotVal) patch.shot = [shotVal]

    const lightCard = getCard('lighting', draw.lighting)
    const lightVal = LIGHTING_TO_CHIP[lightCard]
    if (lightVal) patch.light = [lightVal]

    const colorCard = getCard('color', draw.color)
    const colorVal = COLOR_TO_CHIP[colorCard]
    if (colorVal) patch.color = [colorVal]

    const locCard = getCard('location', draw.location)
    const envVal = LOCATION_TO_ENV[locCard]
    if (envVal) patch.env = [envVal]

    return patch
  }, [draw])

  const dirKey = useMemo(() => {
    const dirCard = getCard('director', draw.director)
    return DIRECTOR_DECK_MAP[dirCard] ?? null
  }, [draw])

  const handleApply = () => {
    if (!onApply) return
    onApply({
      scene: applyScene ? sceneText : null,
      narrativeBeat: applyBeat ? narrativeBeat : null,
      dirKey: applyDirector ? dirKey : null,
      chips: applyChips ? chipPatch : null,
    })
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.toggleLabel}>Scene deck</span>
        <span className={styles.toggleHint}>two-character card draw</span>
        <span className={styles.toggleChevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.body}>
          {/* ── Top controls ─────────────────────────────────────── */}
          <div className={styles.topBar}>
            <button type="button" className={styles.drawAllBtn} onClick={drawAll}>
              <DiceIcon /> Draw all
            </button>
            <div className={styles.presetRow}>
              {PRESET_DRAWS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className={`${styles.presetBtn} ${activePreset === p.label ? styles.presetActive : ''}`}
                  onClick={() => applyPreset(p)}
                  title={p.label}
                >
                  {p.label.replace(' draw', '')}
                </button>
              ))}
            </div>
          </div>

          {/* ── Card groups ──────────────────────────────────────── */}
          {Object.entries(GROUP_ORDER).map(([groupId, catIds]) => (
            <div key={groupId} className={styles.group}>
              <div className={styles.groupLabel}>{GROUP_LABELS[groupId]}</div>
              <div className={styles.groupRows}>
                {catIds.map((catId) => (
                  <CategoryRow
                    key={catId}
                    categoryId={catId}
                    index={draw[catId] ?? 0}
                    onReroll={() => rerollSingle(catId)}
                    onCycle={() => cycleSingle(catId)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* ── Formula preview ──────────────────────────────────── */}
          <div className={styles.formulaBlock}>
            <div className={styles.formulaLabel}>Formula preview</div>
            <p className={styles.formula}>{formula}</p>
          </div>

          {/* ── Apply controls ───────────────────────────────────── */}
          <div className={styles.applySection}>
            <div className={styles.applyToggles}>
              <label className={styles.toggle2}>
                <input type="checkbox" checked={applyScene} onChange={(e) => setApplyScene(e.target.checked)} />
                <span>Scene text</span>
              </label>
              <label className={styles.toggle2}>
                <input type="checkbox" checked={applyBeat} onChange={(e) => setApplyBeat(e.target.checked)} />
                <span>Narrative beat</span>
              </label>
              <label className={styles.toggle2}>
                <input type="checkbox" checked={applyDirector} onChange={(e) => setApplyDirector(e.target.checked)} />
                <span>Director ({getCard('director', draw.director)})</span>
              </label>
              <label className={styles.toggle2}>
                <input type="checkbox" checked={applyChips} onChange={(e) => setApplyChips(e.target.checked)} />
                <span>Visual chips</span>
              </label>
            </div>
            <button type="button" className={styles.applyBtn} onClick={handleApply}>
              Apply to workspace
            </button>
          </div>

          {/* ── What will be applied preview ─────────────────────── */}
          <details className={styles.details}>
            <summary className={styles.detailsSummary}>Preview what will be applied</summary>
            <div className={styles.detailsBody}>
              {applyScene && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>Scene →</span>
                  <span className={styles.detailVal}>{sceneText}</span>
                </div>
              )}
              {applyBeat && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>Beat →</span>
                  <span className={styles.detailVal}>{narrativeBeat}</span>
                </div>
              )}
              {applyDirector && dirKey && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>Director →</span>
                  <span className={styles.detailVal}>{getCard('director', draw.director)}</span>
                </div>
              )}
              {applyChips && Object.keys(chipPatch).length > 0 && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>Chips →</span>
                  <span className={styles.detailVal}>
                    {Object.entries(chipPatch).map(([k, v]) => `${k}: ${v[0]}`).join(' · ')}
                  </span>
                </div>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
