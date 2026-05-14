import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProject } from '../context/ProjectContext.jsx'
import { toSnakeSlug } from '../utils/slugify.js'
import styles from './ProjectSelector.module.css'

function normalizeProjectSlug(raw, fallbackName) {
  const trimmed = String(raw ?? '').trim()
  if (trimmed) {
    return trimmed
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }
  const fromName = toSnakeSlug(fallbackName).replace(/_/g, '-')
  return fromName.replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export default function ProjectSelector() {
  const { active, projects, setActiveById, createProject } = useProject()
  const activeProjects = useMemo(
    () => projects.filter((p) => p.active),
    [projects],
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const rootRef = useRef(null)

  const closeAll = useCallback(() => {
    setMenuOpen(false)
    setCreating(false)
    setSlug('')
    setName('')
    setFormError('')
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) closeAll()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') closeAll()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen, closeAll])

  const triggerLabel = active?.name?.trim()
    ? active.name
    : activeProjects.length
      ? 'Select project…'
      : 'Loading projects…'

  const toggleMenu = () => {
    setMenuOpen((o) => !o)
    if (creating) {
      setCreating(false)
      setFormError('')
      setSlug('')
      setName('')
    }
  }

  const pickProject = (id) => {
    setActiveById(id)
    closeAll()
  }

  const startCreate = () => {
    setCreating(true)
    setFormError('')
    setSlug('')
    setName('')
  }

  const cancelCreate = () => {
    setCreating(false)
    setFormError('')
    setSlug('')
    setName('')
  }

  const onSubmitCreate = async (e) => {
    e.preventDefault()
    const nameTrim = name.trim()
    const slugNorm = normalizeProjectSlug(slug, nameTrim)
    if (!nameTrim || !slugNorm) {
      setFormError('Enter a name and a slug (or leave slug blank to derive from name).')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      const item = await createProject({ slug: slugNorm, name: nameTrim })
      setActiveById(item.id)
      closeAll()
    } catch (err) {
      setFormError(err?.message ?? 'Could not create project.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.bar}>
      <div className={styles.inner} ref={rootRef}>
        <div className={styles.wrap}>
          <button
            type="button"
            className={styles.trigger}
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            onClick={toggleMenu}
          >
            {triggerLabel}
          </button>
          {menuOpen ? (
            <div className={styles.menu} role="listbox" aria-label="Projects">
              {!creating ? (
                <>
                  {activeProjects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={p.id === active?.id}
                      className={`${styles.option} ${p.id === active?.id ? styles.optionActive : ''}`}
                      onClick={() => pickProject(p.id)}
                    >
                      {p.name}
                    </button>
                  ))}
                  <div className={styles.divider} />
                  <button type="button" className={`${styles.option} ${styles.optionMuted}`} onClick={startCreate}>
                    New project…
                  </button>
                </>
              ) : (
                <>
                  <div className={styles.newLabel}>New project</div>
                  <form className={styles.form} onSubmit={onSubmitCreate}>
                    <div className={styles.field}>
                      <label htmlFor="qpb-new-project-slug">Slug</label>
                      <input
                        id="qpb-new-project-slug"
                        name="slug"
                        autoComplete="off"
                        value={slug}
                        onChange={(ev) => setSlug(ev.target.value)}
                        placeholder="e.g. my-film"
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="qpb-new-project-name">Name</label>
                      <input
                        id="qpb-new-project-name"
                        name="name"
                        autoComplete="off"
                        value={name}
                        onChange={(ev) => setName(ev.target.value)}
                        placeholder="Display name"
                      />
                    </div>
                    <div className={styles.formActions}>
                      <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                        {submitting ? 'Creating…' : 'Create'}
                      </button>
                      <button type="button" className={styles.btnGhost} onClick={cancelCreate} disabled={submitting}>
                        Back
                      </button>
                    </div>
                  </form>
                </>
              )}
              {formError ? <div className={styles.error}>{formError}</div> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
