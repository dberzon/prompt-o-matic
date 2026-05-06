import { useState, useRef, useEffect, useCallback } from 'react'
import styles from './SceneInput.module.css'

function getAtQuery(value, cursorPos) {
  const text = value.slice(0, cursorPos)
  const match = text.match(/@([a-z0-9_-]*)$/i)
  if (!match) return null
  return { query: match[1].toLowerCase(), atStart: match.index }
}

export default function SceneInput({ value, onChange, availableSlugs = [] }) {
  const [atQuery, setAtQuery] = useState(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const textareaRef = useRef(null)
  const dropdownRef = useRef(null)

  const filtered = atQuery === null ? [] : availableSlugs.filter(s =>
    !atQuery.query || s.slug.startsWith(atQuery.query) || s.name.toLowerCase().startsWith(atQuery.query)
  )

  const insertSlug = useCallback((slug) => {
    if (atQuery === null || !textareaRef.current) return
    const ta = textareaRef.current
    const cursor = ta.selectionStart
    const before = value.slice(0, atQuery.atStart)
    const after = value.slice(cursor)
    const insertion = `@${slug}`
    onChange(before + insertion + after)
    setAtQuery(null)
    requestAnimationFrame(() => {
      const pos = before.length + insertion.length
      ta.setSelectionRange(pos, pos)
      ta.focus()
    })
  }, [atQuery, value, onChange])

  const handleChange = useCallback((e) => {
    const newValue = e.target.value
    onChange(newValue)
    const q = getAtQuery(newValue, e.target.selectionStart)
    setAtQuery(q)
    setSelectedIdx(0)
  }, [onChange])

  const handleKeyDown = useCallback((e) => {
    if (atQuery === null || filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault()
      insertSlug(filtered[selectedIdx].slug)
    } else if (e.key === 'Escape') {
      setAtQuery(null)
    }
  }, [atQuery, filtered, selectedIdx, insertSlug])

  useEffect(() => {
    if (atQuery === null) return
    function onMouseDown(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          e.target !== textareaRef.current) {
        setAtQuery(null)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [atQuery])

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.label}>Scene description</span>
        <span className={styles.hint}>
          environment · objects · context — type @slug to cast a character
        </span>
      </div>
      <div className={styles.inputWrap}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="e.g. outskirts of an eastern European village, old coal mine headframe in the background, unpaved road, late autumn"
          rows={3}
          spellCheck={false}
        />
        {atQuery !== null && (
          <div ref={dropdownRef} className={styles.dropdown}>
            {filtered.length === 0 ? (
              <div className={styles.dropdownEmpty}>No matching characters</div>
            ) : (
              filtered.map((item, idx) => (
                <div
                  key={item.slug}
                  className={`${styles.dropdownItem} ${idx === selectedIdx ? styles.dropdownItemActive : ''}`}
                  onMouseDown={e => { e.preventDefault(); insertSlug(item.slug) }}
                  onMouseEnter={() => setSelectedIdx(idx)}
                >
                  <span className={styles.dropdownSlug}>@{item.slug}</span>
                  <span className={styles.dropdownName}>{item.name}</span>
                  <span className={styles.dropdownSource}>{item.source}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
