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

export default function ActorDetail({ character, images, onBack }) {
  const { name, age, genderPresentation, cinematicArchetype, distinctiveFeatures, visualKeywords } = character

  const metaParts = [age, genderPresentation, cinematicArchetype].filter(Boolean)

  return (
    <div className={styles.detail}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          ← Back to Actor Bank
        </button>
      </div>

      <div className={styles.hero}>
        <h2 className={styles.name}>{name ?? 'Unnamed'}</h2>
        {metaParts.length > 0 && (
          <div className={styles.herMeta}>{metaParts.join(' · ')}</div>
        )}
      </div>

      {images.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Reference images</h3>
          <div className={styles.imageStrip}>
            {images.map((img) => (
              <div key={img.id} className={styles.imageCard}>
                <img
                  src={img.imageUrl}
                  alt={img.viewType ?? 'character'}
                  loading="lazy"
                  className={styles.image}
                />
                <span className={styles.imageLabel}>
                  {(img.viewType ?? '').replace(/_/g, ' ')}
                </span>
              </div>
            ))}
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
