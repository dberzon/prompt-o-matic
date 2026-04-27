import { useMemo, useState } from 'react'
import styles from './CommandPalette.module.css'

export default function CommandPalette({ open, commands, onClose }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((cmd) => cmd.label.toLowerCase().includes(q))
  }, [commands, query])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <input
          className={styles.input}
          placeholder="Type a command..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className={styles.list}>
          {filtered.map((cmd) => (
            <button
              key={cmd.id}
              className={styles.item}
              disabled={!!cmd.disabled}
              onClick={() => {
                if (cmd.disabled) return
                cmd.run()
                onClose()
              }}
            >
              {cmd.label}
            </button>
          ))}
          {filtered.length === 0 && <p className={styles.empty}>No matching commands.</p>}
        </div>
      </div>
    </div>
  )
}
