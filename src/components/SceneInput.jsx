import styles from './SceneInput.module.css'

export default function SceneInput({ value, onChange }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.label}>Scene description</span>
        <span className={styles.hint}>
          environment · objects · context — interaction scenarios stay below; scene seeds append as a brief you trim to static, material beats
        </span>
      </div>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="e.g. outskirts of an eastern European village, old coal mine headframe in the background, unpaved road, late autumn"
        rows={3}
        spellCheck={false}
      />
    </div>
  )
}
