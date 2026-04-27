import { useEffect, useState } from 'react'
import styles from './ReferenceBoard.module.css'

export default function ReferenceBoard() {
  const [items, setItems] = useState([])

  useEffect(() => () => {
    items.forEach((item) => URL.revokeObjectURL(item.url))
  }, [items])

  const handleFiles = (event) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    const next = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      url: URL.createObjectURL(file),
      note: '',
    }))
    setItems((prev) => [...next, ...prev].slice(0, 8))
    event.target.value = ''
  }

  const updateNote = (id, note) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, note } : item)))
  }

  const removeItem = (id) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((item) => item.id !== id)
    })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.title}>Reference board</span>
        <label className={styles.uploadBtn}>
          Add images
          <input type="file" accept="image/*" multiple onChange={handleFiles} />
        </label>
      </div>
      {items.length === 0 ? (
        <p className={styles.empty}>Add references to keep visual targets in view while prompting.</p>
      ) : (
        <div className={styles.grid}>
          {items.map((item) => (
            <div key={item.id} className={styles.card}>
              <img src={item.url} alt={item.name} className={styles.thumb} />
              <textarea
                className={styles.note}
                placeholder="Notes..."
                value={item.note}
                onChange={(e) => updateNote(item.id, e.target.value)}
                rows={2}
              />
              <button className={styles.removeBtn} onClick={() => removeItem(item.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
