import { useEffect, useState } from 'react'
import styles from './ReferenceBoard.module.css'

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.readAsDataURL(file)
  })
}

export default function ReferenceBoard() {
  const [items, setItems] = useState([])

  useEffect(() => () => {
    items.forEach((item) => URL.revokeObjectURL(item.url))
  }, [items])

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    const dataUrls = await Promise.all(files.map(readFileAsDataUrl))
    const next = files.map((file, i) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      url: URL.createObjectURL(file),
      dataUrl: dataUrls[i],
      note: '',
      analysis: null,
      analyzing: false,
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

  const analyze = async (id) => {
    const item = items.find((i) => i.id === id)
    if (!item?.dataUrl) return
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, analyzing: true, analysis: null } : i)))
    try {
      const res = await fetch('/api/analyze-reference-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: item.dataUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, analyzing: false, analysis: data.features ?? null } : i))
      )
    } catch (err) {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, analyzing: false, analysis: { error: err.message || 'Analysis failed' } } : i))
      )
    }
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
              <div className={styles.cardActions}>
                <button
                  className={styles.analyzeBtn}
                  onClick={() => analyze(item.id)}
                  disabled={item.analyzing}
                >
                  {item.analyzing ? 'Analyzing…' : 'Analyze'}
                </button>
                <button className={styles.removeBtn} onClick={() => removeItem(item.id)}>
                  Remove
                </button>
              </div>
              <textarea
                className={styles.note}
                placeholder="Notes..."
                value={item.note}
                onChange={(e) => updateNote(item.id, e.target.value)}
                rows={2}
              />
              {item.analysis && !item.analysis.error && (
                <div className={styles.analysis}>
                  {item.analysis.palette && (
                    <p className={styles.analysisRow}>
                      <span className={styles.analysisLabel}>Palette</span>
                      {item.analysis.palette}
                    </p>
                  )}
                  {item.analysis.lighting && (
                    <p className={styles.analysisRow}>
                      <span className={styles.analysisLabel}>Light</span>
                      {item.analysis.lighting}
                    </p>
                  )}
                  {item.analysis.composition && (
                    <p className={styles.analysisRow}>
                      <span className={styles.analysisLabel}>Shot</span>
                      {item.analysis.composition}
                    </p>
                  )}
                  {item.analysis.filmCharacter && (
                    <p className={styles.analysisRow}>
                      <span className={styles.analysisLabel}>Film</span>
                      {item.analysis.filmCharacter}
                    </p>
                  )}
                  {item.analysis.mood && (
                    <p className={styles.analysisRow}>
                      <span className={styles.analysisLabel}>Mood</span>
                      {item.analysis.mood}
                    </p>
                  )}
                  {item.analysis.notes && (
                    <p className={styles.analysisRow}>
                      <span className={styles.analysisLabel}>Notes</span>
                      {item.analysis.notes}
                    </p>
                  )}
                </div>
              )}
              {item.analysis?.error && (
                <p className={styles.analysisError}>{item.analysis.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
