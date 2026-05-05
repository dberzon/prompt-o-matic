import styles from './ActorCard.module.css'

const STATUS_LABEL = {
  ready: 'ready',
  portfolio_pending: 'rendering',
  portfolio_failed: 'failed',
  auditioned: 'auditioned',
  preview: 'preview',
}

export default function ActorCard({ character, onSelect, isSelected }) {
  const { id, name, age, genderPresentation, cinematicArchetype, thumbnailUrl, lifecycleStatus, imageCount, archived_at } = character ?? {}

  return (
    <button
      type="button"
      className={`${styles.card} ${isSelected ? styles.selected : ''} ${archived_at ? styles.archived : ''}`}
      onClick={() => onSelect?.(id)}
      aria-pressed={isSelected}
    >
      <div className={styles.thumb}>
        {thumbnailUrl
          ? <img src={thumbnailUrl} alt={name ?? 'Character'} loading="lazy" className={styles.img} />
          : <div className={styles.placeholder} aria-hidden="true" />}
        {lifecycleStatus && (
          <div className={`${styles.statusBadge} ${styles[`status_${lifecycleStatus}`] ?? ''}`}>
            {STATUS_LABEL[lifecycleStatus] ?? lifecycleStatus}
          </div>
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.name}>{name ?? 'Unnamed'}</div>
        <div className={styles.meta}>
          <span>{[age, genderPresentation].filter(Boolean).join(' · ')}</span>
          {imageCount > 0 && <span className={styles.imageCount}>{imageCount}&nbsp;img{imageCount !== 1 ? 's' : ''}</span>}
        </div>
        {cinematicArchetype && (
          <div className={styles.archetype}>{cinematicArchetype}</div>
        )}
        {archived_at && <div className={styles.archivedLabel}>archived</div>}
      </div>
    </button>
  )
}
