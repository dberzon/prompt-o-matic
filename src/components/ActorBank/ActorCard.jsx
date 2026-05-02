import styles from './ActorCard.module.css'

export default function ActorCard({ character, onSelect, isSelected }) {
  const { id, name, age, genderPresentation, cinematicArchetype, thumbnailUrl } = character ?? {}

  return (
    <button
      type="button"
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      onClick={() => onSelect?.(id)}
      aria-pressed={isSelected}
    >
      <div className={styles.thumb}>
        {thumbnailUrl
          ? <img src={thumbnailUrl} alt={name ?? 'Character'} loading="lazy" className={styles.img} />
          : <div className={styles.placeholder} aria-hidden="true" />}
      </div>
      <div className={styles.info}>
        <div className={styles.name}>{name ?? 'Unnamed'}</div>
        <div className={styles.meta}>
          {[age, genderPresentation].filter(Boolean).join(' · ')}
        </div>
        {cinematicArchetype && (
          <div className={styles.archetype}>{cinematicArchetype}</div>
        )}
      </div>
    </button>
  )
}
