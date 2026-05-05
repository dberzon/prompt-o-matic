import { useCallback, useRef } from 'react'
import styles from './ActorBankFilters.module.css'

const GENDERS = ['All', 'Male', 'Female', 'Non-binary']

const SORT_OPTIONS = [
  { value: 'last_rendered_at', label: 'Recent renders' },
  { value: 'created_at', label: 'Recently created' },
  { value: 'name', label: 'A–Z by name' },
]

export default function ActorBankFilters({ filters, onChange }) {
  const debounceRef = useRef(null)

  const emit = useCallback((patch) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onChange(patch), 300)
  }, [onChange])

  const handleSearch = (e) => emit({ search: e.target.value })
  const handleGender = (g) => emit({ gender: g === 'All' ? '' : g })
  const handleAgeMin = (e) => emit({ ageMin: e.target.value === '' ? '' : Number(e.target.value) })
  const handleAgeMax = (e) => emit({ ageMax: e.target.value === '' ? '' : Number(e.target.value) })
  const handleSort = (e) => onChange({ sortBy: e.target.value })

  const activeGender = filters.gender || 'All'

  return (
    <div className={styles.bar}>
      <input
        type="search"
        className={styles.search}
        placeholder="Search name or archetype…"
        defaultValue={filters.search}
        onChange={handleSearch}
        aria-label="Search characters"
      />
      <div className={styles.genderChips}>
        {GENDERS.map((g) => (
          <button
            key={g}
            type="button"
            className={`${styles.chip} ${activeGender === g ? styles.chipActive : ''}`}
            onClick={() => handleGender(g)}
          >
            {g}
          </button>
        ))}
      </div>
      <div className={styles.ageRange}>
        <label className={styles.ageLabel}>Age</label>
        <input
          type="number"
          className={styles.ageInput}
          placeholder="from"
          min={16}
          max={100}
          defaultValue={filters.ageMin}
          onChange={handleAgeMin}
          aria-label="Minimum age"
        />
        <span className={styles.ageSep}>–</span>
        <input
          type="number"
          className={styles.ageInput}
          placeholder="to"
          min={16}
          max={100}
          defaultValue={filters.ageMax}
          onChange={handleAgeMax}
          aria-label="Maximum age"
        />
      </div>
      <select
        className={styles.sortSelect}
        value={filters.sortBy || 'last_rendered_at'}
        onChange={handleSort}
        aria-label="Sort order"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
