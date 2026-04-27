import { useState } from 'react'
import styles from './Header.module.css'

export default function Header({ onClear }) {
  const [guideOpen, setGuideOpen] = useState(false)

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.title}>
          <div className={styles.logoMark}>
            <span className={styles.aperture}>◎</span>
          </div>
          <div>
            <h1 className={styles.name}>Qwen Prompt Builder</h1>
            <p className={styles.sub}>
              Cinematic prompt assembly for text-to-image generation
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          <a
            className={styles.link}
            href="https://chat.qwen.ai"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Qwen ↗
          </a>
          <button className={styles.clearBtn} onClick={onClear}>
            Reset
          </button>
          <button
            className={styles.guideBtn}
            onClick={() => setGuideOpen((open) => !open)}
            aria-expanded={guideOpen}
            aria-controls="quick-start-guide"
            type="button"
          >
            {guideOpen ? 'Hide guide' : 'How to use'}
          </button>
        </div>
      </div>
      {guideOpen ? (
        <div id="quick-start-guide" className={styles.guidePanel}>
          <p className={styles.guideTitle}>Quick start (first 60 seconds)</p>
          <ol className={styles.guideList}>
            <li>Set 1, 2, or 3 characters and adjust age/gender.</li>
            <li>Describe your scene in plain language.</li>
            <li>Pick a director and choose one interaction scenario.</li>
            <li>Add technical chips (shot, lens, light, palette, film stock).</li>
            <li>Use a preset for speed, then fine-tune.</li>
            <li>Copy the assembled prompt and run it in Qwen.</li>
          </ol>
        </div>
      ) : null}
    </header>
  )
}
