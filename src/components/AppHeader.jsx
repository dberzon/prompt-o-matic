import Header from './Header.jsx'
import ProjectSelector from '../app/ProjectSelector.jsx'
import styles from './AppHeader.module.css'

/**
 * Persistent app chrome: branding/header actions and project selector.
 */
export default function AppHeader({ onClear, comfyStatus, comfyError }) {
  return (
    <div className={styles.headerChrome} data-testid="app-header">
      <Header onClear={onClear} comfyStatus={comfyStatus} comfyError={comfyError} />
      <ProjectSelector />
    </div>
  )
}
