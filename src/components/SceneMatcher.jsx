import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { searchCorpus } from '../utils/sceneSearch.js'
import { DIRECTORS } from '../data/directors.js'
import styles from './SceneMatcher.module.css'

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

const EXAMPLES = [
  'neon rain longing',
  'kubrick corridor',
  'abandoned warehouse mud',
  'confession after sex',
  'smoking on a bed',
]

export default function SceneMatcher({ onApply, matcherRef }) {
  const [open, setOpen] = useState(false)
  const [rawQuery, setRawQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const inputRef = useRef(null)

  // Expose a focus handle upward (used by command palette "focus match").
  useEffect(() => {
    if (!matcherRef) return
    matcherRef.current = {
      focus: () => {
        setOpen(true)
        requestAnimationFrame(() => inputRef.current?.focus())
      },
    }
    return () => {
      if (matcherRef.current?.focus) matcherRef.current = null
    }
  }, [matcherRef])

  // Debounce the query ~120ms
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(rawQuery), 120)
    return () => clearTimeout(id)
  }, [rawQuery])

  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return { directors: [], seeds: [], cards: [], total: 0 }
    return searchCorpus(debouncedQuery)
  }, [debouncedQuery])

  const applyDirector = useCallback((dirKey) => {
    onApply?.({ dirKey, applyPreset: true })
  }, [onApply])

  const applySeed = useCallback((seed) => {
    onApply?.({
      scene: seed.seedText,
      dirKey: seed.dirKey,
      applyPreset: true,
      narrativeBeat: seed.styleKey
        ? `Style key: ${seed.styleKey}. Seed: ${seed.seedText}`
        : seed.seedText,
    })
  }, [onApply])

  const applyCard = useCallback((card) => {
    onApply?.({
      scene: card.cardText,
      chipPatch: card.chipPatch ?? null,
    })
  }, [onApply])

  const applyTopResult = useCallback(() => {
    if (results.directors[0]) applyDirector(results.directors[0].dirKey)
    else if (results.seeds[0]) applySeed(results.seeds[0])
    else if (results.cards[0]) applyCard(results.cards[0])
  }, [results, applyDirector, applySeed, applyCard])

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      applyTopResult()
    } else if (e.key === 'Escape') {
      setRawQuery('')
    }
  }

  const hasQuery = debouncedQuery.trim().length > 0
  const noResults = hasQuery && results.total === 0

  // Group card results by category for display
  const cardsByCategory = useMemo(() => {
    const map = new Map()
    for (const c of results.cards) {
      if (!map.has(c.categoryLabel)) map.set(c.categoryLabel, [])
      map.get(c.categoryLabel).push(c)
    }
    return Array.from(map.entries())
  }, [results.cards])

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.toggleLabel}>Match from library</span>
        <span className={styles.toggleHint}>
          keywords or a short scene description — matches directors, seeds, and deck cards
        </span>
        <span className={styles.toggleChevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.body}>
          <div className={styles.searchRow}>
            <span className={styles.searchIcon}><SearchIcon /></span>
            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              placeholder="e.g. neon hallway, smoking on a bed, kubrick corridor"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              autoComplete="off"
            />
            {rawQuery && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => setRawQuery('')}
                aria-label="Clear search"
                title="Clear"
              >
                <ClearIcon />
              </button>
            )}
          </div>

          {!hasQuery && (
            <div className={styles.examples}>
              <span className={styles.examplesLabel}>Try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className={styles.exampleBtn}
                  onClick={() => setRawQuery(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          {noResults && (
            <div className={styles.noResults}>
              No matches. Try broader keywords, a director name, or an action/mood.
            </div>
          )}

          {hasQuery && results.directors.length > 0 && (
            <div className={styles.group}>
              <div className={styles.groupLabel}>
                Directors <span className={styles.groupCount}>({results.directors.length})</span>
              </div>
              <div className={styles.resultList}>
                {results.directors.map((r) => {
                  const d = DIRECTORS[r.dirKey]
                  if (!d) return null
                  return (
                    <div key={r.dirKey} className={styles.row}>
                      <div className={styles.rowMain}>
                        <div className={styles.rowTitle}>{d.name}</div>
                        <div className={styles.rowPreview}>{d.note}</div>
                        {r.matchedTokens.length > 0 && (
                          <div className={styles.tokenRow}>
                            {r.matchedTokens.slice(0, 8).map((t) => (
                              <span key={t} className={styles.tokenChip}>{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className={styles.applyBtn}
                        onClick={() => applyDirector(r.dirKey)}
                        title="Select director + apply preset chips"
                      >
                        Apply
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {hasQuery && results.seeds.length > 0 && (
            <div className={styles.group}>
              <div className={styles.groupLabel}>
                Scene seeds <span className={styles.groupCount}>({results.seeds.length})</span>
              </div>
              <div className={styles.resultList}>
                {results.seeds.map((r, i) => {
                  const d = DIRECTORS[r.dirKey]
                  return (
                    <div key={`${r.dirKey}:${i}`} className={styles.row}>
                      <div className={styles.rowMain}>
                        <div className={styles.rowTitle}>
                          <span className={styles.seedText}>{r.seedText}</span>
                        </div>
                        <div className={styles.rowMeta}>
                          <span className={styles.metaTag}>from {d?.short ?? r.dirKey}</span>
                          {r.styleKey && (
                            <span className={styles.metaNote}>{r.styleKey}</span>
                          )}
                        </div>
                        {r.matchedTokens.length > 0 && (
                          <div className={styles.tokenRow}>
                            {r.matchedTokens.slice(0, 8).map((t) => (
                              <span key={t} className={styles.tokenChip}>{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className={styles.applyBtn}
                        onClick={() => applySeed(r)}
                        title="Append seed to scene, select director, apply preset chips, set beat"
                      >
                        Apply
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {hasQuery && cardsByCategory.length > 0 && (
            <div className={styles.group}>
              <div className={styles.groupLabel}>
                Deck cards <span className={styles.groupCount}>({results.cards.length})</span>
              </div>
              <div className={styles.resultList}>
                {cardsByCategory.map(([label, items]) => (
                  <div key={label} className={styles.cardGroup}>
                    <div className={styles.cardGroupLabel}>{label}</div>
                    <div className={styles.cardGroupList}>
                      {items.map((r) => (
                        <div
                          key={`${r.categoryId}:${r.cardIndex}`}
                          className={styles.cardRow}
                        >
                          <div className={styles.cardRowMain}>
                            <span className={styles.cardText}>{r.cardText}</span>
                            {r.chipPatch && (
                              <span className={styles.chipHint}>
                                {Object.entries(r.chipPatch).map(([k, v]) => `${k}: ${v[0]}`).join(' · ')}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className={styles.applyBtnSm}
                            onClick={() => applyCard(r)}
                            title={r.chipPatch ? 'Append to scene + apply chip mapping' : 'Append to scene'}
                          >
                            Apply
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
