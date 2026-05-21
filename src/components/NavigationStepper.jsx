import styles from './NavigationStepper.module.css'

const STEPS = [
  { index: 1, label: 'Casting' },
  { index: 2, label: 'Bible' },
  { index: 3, label: 'Extrapolation' },
  { index: 4, label: 'Prompt Studio' },
  { index: 5, label: 'Render' },
  { index: 6, label: 'Portfolio' },
]

/**
 * @param {{ activeStep: number, setActiveStep: (step: number) => void }} props
 */
export default function NavigationStepper({ activeStep, setActiveStep }) {
  return (
    <nav className={styles.stepper} aria-label="Workflow stepper">
      <ol className={styles.list}>
        {STEPS.map((step) => {
          const isActive = activeStep === step.index
          return (
            <li key={step.index} className={styles.item}>
              <button
                type="button"
                className={`${styles.stepBtn} ${isActive ? styles.stepBtnActive : ''}`}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => setActiveStep(step.index)}
              >
                <span className={styles.stepNum}>{step.index}</span>
                <span className={styles.stepLabel}>{step.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
