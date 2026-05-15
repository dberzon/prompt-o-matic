import { useEffect, useMemo, useState } from 'react'
import { getEntity } from '../lib/api/entities.js'
import AttributeReviewPanel from './AttributeReviewPanel.jsx'
import EntityConflictPanel from './EntityConflictPanel.jsx'
import CanonAttributesPanel from './CanonAttributesPanel.jsx'
import EntityExtrapolationPanel from './EntityExtrapolationPanel.jsx'
import VisualAnchorPicker from './VisualAnchorPicker.jsx'
import BibleEditor from '../features/bible/BibleEditor.jsx'
import styles from './EntityEditor.module.css'

const SECTIONS_BY_TYPE = {
  character: ['Identity', 'Appearance', 'Wardrobe', 'Relationships', 'Bible', 'Continuity'],
  environment: ['Location', 'Atmosphere', 'Bible', 'Continuity'],
  location: ['Identity', 'Geography', 'Function', 'Bible', 'Continuity'],
  prop: ['Details', 'Bible', 'Continuity'],
  institution: ['Details', 'Bible', 'Continuity'],
  era: ['Identity', 'Timeframe', 'Bible', 'Continuity'],
}

export default function EntityEditor({ entityId, onEntityChange }) {
  const [entity, setEntity] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState('Identity')

  useEffect(() => {
    if (!entityId) {
      setEntity(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    getEntity(entityId)
      .then((result) => {
        if (cancelled) return
        setEntity(result?.item || null)
        const sections = SECTIONS_BY_TYPE[result?.item?.type] || SECTIONS_BY_TYPE.character
        setActiveSection(sections[0])
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message || 'Failed to load entity')
        setEntity(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [entityId])

  const sections = useMemo(
    () => SECTIONS_BY_TYPE[entity?.type] || SECTIONS_BY_TYPE.character,
    [entity?.type],
  )

  if (!entityId) {
    return <p className={styles.empty}>Select an entity to open the editor.</p>
  }

  if (loading) {
    return <p className={styles.status}>Loading entity…</p>
  }

  if (error) {
    return <p className={styles.error}>{error}</p>
  }

  if (!entity) {
    return <p className={styles.empty}>Entity not found.</p>
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>{entity.name}</h2>
          <p className={styles.subtitle}>{entity.type} · {entity.id}</p>
        </div>
        {onEntityChange ? (
          <button type="button" className={styles.refreshBtn} onClick={() => onEntityChange(entity.id)}>
            Refresh
          </button>
        ) : null}
      </header>

      <nav className={styles.sectionNav} aria-label="Entity sections">
        {sections.map((section) => (
          <button
            key={section}
            type="button"
            className={`${styles.sectionBtn} ${activeSection === section ? styles.sectionBtnActive : ''}`}
            onClick={() => setActiveSection(section)}
          >
            {section}
          </button>
        ))}
      </nav>

      <section className={styles.sectionBody}>
        {activeSection === 'Bible' ? (
          <BibleEditor entityId={entityId} />
        ) : activeSection === 'Continuity' ? (
          <VisualAnchorPicker entityId={entityId} />
        ) : (
          <CanonAttributesPanel entityId={entityId} sectionPrefix={activeSection.toLowerCase()} />
        )}
      </section>

      {activeSection !== 'Bible' ? (
        <>
          <EntityExtrapolationPanel entityId={entityId} />
          <AttributeReviewPanel entityId={entityId} />
          <EntityConflictPanel entityId={entityId} />
        </>
      ) : null}
    </div>
  )
}
