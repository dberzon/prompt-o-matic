import { useRef, useState, useMemo } from 'react'
import { CHIP_GROUPS } from '../data/chips.js'
import { PRESETS, FEATURED_PRESET_KEYS, DIRECTOR_PRESETS } from '../data/constants.js'
import { useSectionState } from '../hooks/useSectionState.js'
import styles from './ChipSection.module.css'

const TIME_OF_DAY_PRESETS = [
  { label: 'Dawn', chips: {
    light: ['magic hour, golden light from below the cloud line'],
    texture: ['frost on dead grass, thin ice on puddles'],
    color: ['cool blue-gray, low contrast midtones'],
  }},
  { label: 'Morning', chips: {
    light: ['flat overcast light, uniform gray sky, no cast shadows'],
    color: ['cool blue-gray, low contrast midtones'],
  }},
  { label: 'Midday', chips: {
    light: ['harsh midday overhead sun, high contrast'],
    texture: ['heat shimmer over asphalt, air wavering'],
    color: ['drained earth tones, brown and pale beige, very low saturation'],
  }},
  { label: 'Golden hour', chips: {
    light: ['magic hour, golden light from below the cloud line'],
    texture: ['dust suspended in shaft of light'],
    color: ['warm amber interior light against cold blue exterior'],
  }},
  { label: 'Blue hour', chips: {
    light: ['late afternoon fading light, sky brighter than ground'],
    color: ['cool blue-gray, low contrast midtones'],
  }},
  { label: 'Night rain', chips: {
    light: ['neon and available light, night exterior'],
    texture: ['rain-soaked surfaces, reflections of sky in wet ground'],
    color: ['night-city cyan and orange, neon palette'],
  }},
  { label: 'Night clear', chips: {
    light: ['sodium street lamp, amber monochrome cast'],
    texture: ['city lights reflected in wet asphalt'],
    color: ['cool blue-gray, low contrast midtones'],
  }},
  { label: 'Fog', chips: {
    light: ['fog-filtered diffused light, no direct source visible'],
    texture: ['heavy fog, middle distance dissolved to pale silhouette'],
    color: ['near-monochrome, color barely present'],
  }},
]

function CollapsibleGroup({ group, chips, onToggle }) {
  const [open, setOpen] = useSectionState(`chip-group-${group.id}`, false)
  const panelId = `chip-group-panel-${group.id}`

  const selectedCount = group.subsections.reduce((sum, sub) => {
    return sum + (chips[sub.id]?.length ?? 0)
  }, 0)

  return (
    <div className={styles.section}>
      <button
        className={styles.sectionHead}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <div className={styles.headLeft}>
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>›</span>
          <span className={styles.sectionLabel}>{group.label}</span>
        </div>
        <span className={styles.badge}>
          {selectedCount > 0 ? `${selectedCount} selected` : 'none'}
        </span>
      </button>

      {open && (
        <div className={styles.sectionBody} id={panelId}>
          {group.note && (
            <p className={styles.sectionNote}>{group.note}</p>
          )}
          {group.subsections.map(sub => (
            <div key={sub.id}>
              {sub.label && (
                <p className={styles.subLabel}>{sub.label}</p>
              )}
              <div className={styles.chips}>
                {sub.chips.map(chip => {
                  const active = chips[sub.id]?.includes(chip.value) ?? false
                  return (
                    <button
                      key={chip.value}
                      className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                      onClick={() => onToggle(sub.id, chip.value)}
                    >
                      {chip.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ChipSection({$1  onMergeChips,
}) {
  const importRef = useRef(null)
  const [importMessage, setImportMessage] = useState('')
  const [directorPresetsOpen, setDirectorPresetsOpen] = useState(false)
  const [directorPresetFilter, setDirectorPresetFilter] = useState('')

  const directorPresetEntries = useMemo(() => Object.entries(DIRECTOR_PRESETS), [])
  const filteredDirectorPresets = useMemo(() => {
    const q = directorPresetFilter.trim().toLowerCase()
    if (!q) return directorPresetEntries
    return directorPresetEntries.filter(([key, preset]) => (
      key.toLowerCase().includes(q) || preset.label?.toLowerCase().includes(q)
    ))
  }, [directorPresetEntries, directorPresetFilter])

  const handleSave = () => {
    const name = window.prompt('Preset name')
    if (!name) return
    const ok = onSaveCustomPreset?.(name)
    setImportMessage(ok ? `Saved preset "${name.trim()}"` : 'Failed to save preset')
  }

  const handleImportClick = () => {
    importRef.current?.click()
  }

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const result = onImportCustomPresets?.(text)
    if (result?.ok) {
      setImportMessage(`Imported ${result.count} preset(s)`)
    } else {
      setImportMessage(result?.reason ?? 'Import failed')
    }
    event.target.value = ''
  }

  return (
    <div className={styles.wrap}>
      {/* Presets */}
      <div className={styles.presetsRow}>
        <span className={styles.presetsLabel}>Technical presets</span>
        <div className={styles.presets}>
          {FEATURED_PRESET_KEYS.map((key) => (
            <button
              key={key}
              className={styles.presetBtn}
              onClick={() => onPreset(key)}
            >
              {PRESETS[key]?.label ?? key}
            </button>
          ))}
          <button
            className={styles.presetBtn}
            onClick={onApplySelectedDirectorPreset}
            disabled={!selectedDir}
            title={selectedDir ? 'Apply selected director technical preset' : 'Select a director first'}
          >
            {selectedDir ? 'Selected director preset' : 'Select director first'}
          </button>
          <button className={styles.presetBtn} onClick={handleSave}>
            Save current as preset
          </button>
          <button className={styles.presetBtn} onClick={onExportCustomPresets}>
            Export presets
          </button>
          <button className={styles.presetBtn} onClick={handleImportClick}>
            Import presets
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
      </div>
      {importMessage && <p className={styles.lastPresetLabel}>{importMessage}</p>}

      {/* Time of day / weather quick-set */}
      {onMergeChips && (
        <div className={styles.quickSetRow}>
          <span className={styles.quickSetLabel}>Time of day</span>
          <div className={styles.quickSetButtons}>
            {TIME_OF_DAY_PRESETS.map((preset) => (
              <button
                key={preset.label}
                className={styles.quickSetBtn}
                onClick={() => onMergeChips(preset.chips)}
                title={`Merge light + texture + color chips for ${preset.label}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Director presets (bespoke per-director technical presets) */}
      <div className={styles.section}>
        <button
          className={styles.sectionHead}
          onClick={() => setDirectorPresetsOpen((o) => !o)}
          aria-expanded={directorPresetsOpen}
          aria-controls="director-presets-panel"
        >
          <div className={styles.headLeft}>
            <span className={`${styles.chevron} ${directorPresetsOpen ? styles.chevronOpen : ''}`}>›</span>
            <span className={styles.sectionLabel}>Director presets</span>
          </div>
          <span className={styles.badge}>{directorPresetEntries.length} directors</span>
        </button>
        {directorPresetsOpen && (
          <div className={styles.sectionBody} id="director-presets-panel">
            <input
              type="text"
              className={styles.directorFilter}
              placeholder="Filter directors..."
              value={directorPresetFilter}
              onChange={(e) => setDirectorPresetFilter(e.target.value)}
            />
            <div className={styles.presets}>
              {filteredDirectorPresets.map(([key, preset]) => (
                <button
                  key={key}
                  className={styles.presetBtn}
                  onClick={() => onPreset(key)}
                  title={`Apply ${preset.label} technical preset`}
                >
                  {preset.label}
                </button>
              ))}
              {filteredDirectorPresets.length === 0 && (
                <span className={styles.lastPresetLabel}>No directors match "{directorPresetFilter}"</span>
              )}
            </div>
          </div>
        )}
      </div>

      {Object.keys(customPresets ?? {}).length > 0 && (
        <div className={styles.presetsRow}>
          <span className={styles.presetsLabel}>Custom presets</span>
          <div className={styles.presets}>
            {Object.entries(customPresets).map(([key, preset]) => (
              <button
                key={key}
                className={styles.presetBtn}
                onClick={() => onPreset(key)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {lastAppliedPresetLabel && (
        <p className={styles.lastPresetLabel}>
          Last applied preset: <span>{lastAppliedPresetLabel}</span>
        </p>
      )}

      {/* Chip groups */}
      {CHIP_GROUPS.map(group => (
        <CollapsibleGroup
          key={group.id}
          group={group}
          chips={chips}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}
