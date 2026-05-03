import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import ActorBankFilters from './ActorBankFilters.jsx'
import ActorCard from './ActorCard.jsx'
import ActorDetail from './ActorDetail.jsx'
import styles from './ActorBankView.module.css'

const INIT = { characters: [], total: 0, loading: true, error: null, selected: null }

function reducer(state, action) {
  switch (action.type) {
    case 'LOADING': return { ...state, loading: true, error: null }
    case 'LOADED': return { ...state, loading: false, characters: action.items, total: action.total }
    case 'ERROR': return { ...state, loading: false, error: action.error }
    case 'SELECT': return { ...state, selected: action.id }
    default: return state
  }
}

export default function ActorBankView() {
  const [state, dispatch] = useReducer(reducer, INIT)
  const filtersRef = useRef({ search: '', gender: '', ageMin: '', ageMax: '' })
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)

  const load = useCallback(async (f = filtersRef.current) => {
    dispatch({ type: 'LOADING' })
    try {
      const params = new URLSearchParams()
      if (f.search) params.set('search', f.search)
      if (f.gender) params.set('gender', f.gender)
      if (f.ageMin !== '' && f.ageMin != null) params.set('ageMin', String(f.ageMin))
      if (f.ageMax !== '' && f.ageMax != null) params.set('ageMax', String(f.ageMax))
      const res = await fetch(`/api/characters?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      dispatch({ type: 'LOADED', items: data.items ?? [], total: data.total ?? 0 })
    } catch (err) {
      dispatch({ type: 'ERROR', error: err.message ?? 'Failed to load characters' })
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleFilterChange = useCallback((patch) => {
    filtersRef.current = { ...filtersRef.current, ...patch }
    load(filtersRef.current)
  }, [load])

  const handleSelect = useCallback(async (id) => {
    dispatch({ type: 'SELECT', id })
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/characters?id=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setDetail({ character: data.item, images: data.item.images ?? [] })
    } catch (err) {
      setDetailError(err.message ?? 'Failed to load character')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleBack = useCallback(() => {
    setDetail(null)
    setDetailError(null)
    dispatch({ type: 'SELECT', id: null })
  }, [])

  const { characters, total, loading, error, selected } = state

  if (detailLoading) {
    return (
      <div className={styles.view}>
        <div className={styles.detailLoadingBar}>
          <button type="button" className={styles.backBtnInline} onClick={handleBack}>← Back</button>
        </div>
        <div className={styles.skeletonDetail} />
      </div>
    )
  }

  if (detailError) {
    return (
      <div className={styles.view}>
        <div className={styles.error}>
          {detailError}
          <button className={styles.retryBtn} type="button" onClick={handleBack}>← Back</button>
        </div>
      </div>
    )
  }

  if (detail) {
    return (
      <div className={styles.view}>
        <ActorDetail character={detail.character} images={detail.images} onBack={handleBack} />
      </div>
    )
  }

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <h2 className={styles.title}>Actor Bank</h2>
        {!loading && !error && (
          <span className={styles.count}>{total} character{total !== 1 ? 's' : ''}</span>
        )}
      </div>

      <ActorBankFilters filters={filtersRef.current} onChange={handleFilterChange} />

      {error && (
        <div className={styles.error}>
          {error}
          <button className={styles.retryBtn} type="button" onClick={() => load()}>Retry</button>
        </div>
      )}

      {loading && (
        <div className={styles.grid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.skeleton} aria-hidden="true" />
          ))}
        </div>
      )}

      {!loading && !error && characters.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Your Actor Bank is empty</p>
          <p className={styles.emptyHint}>
            Approve candidates in the Casting Room to populate your bank.
          </p>
        </div>
      )}

      {!loading && !error && characters.length > 0 && (
        <div className={styles.grid}>
          {characters.map((c) => (
            <ActorCard
              key={c.id}
              character={c}
              isSelected={selected === c.id}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
