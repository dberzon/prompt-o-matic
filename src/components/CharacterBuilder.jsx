import { useMemo, useState } from 'react'
import { useCharacterOptimize } from '../hooks/useCharacterOptimize.js'
import { toSnakeSlug, withUniqueSuffix } from '../utils/slugify.js'
import styles from './CharacterBuilder.module.css'

export default function CharacterBuilder({
  characters,
  setCharacters,
  aiEngine,
  localOnly,
  embeddedStatus,
}) {
  const [name, setName] = useState('')
  const [slugDraft, setSlugDraft] = useState('')
  const [description, setDescription] = useState('')
  const [acceptedText, setAcceptedText] = useState('')
  const [flash, setFlash] = useState('')
  const {
    state,
    optimized,
    provider,
    fallback,
    error,
    optimize,
    reset,
  } = useCharacterOptimize()

  const slugAuto = useMemo(() => toSnakeSlug(name), [name])
  const slug = toSnakeSlug(slugDraft || slugAuto)
  const canSave = Boolean(slug && name.trim() && (acceptedText.trim() || description.trim()))
  const orderedCharacters = useMemo(
    () => Object.values(characters).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [characters]
  )

  const isDuplicate = Boolean(characters[slug] && characters[slug].name !== name.trim())

  const runOptimize = async () => {
    await optimize({
      description,
      engine: aiEngine,
      localOnly,
      embeddedPort: embeddedStatus?.port ?? null,
      embeddedSecret: embeddedStatus?.secret ?? null,
      embeddedModel: embeddedStatus?.modelId ?? null,
    })
  }

  const saveCharacter = () => {
    if (!canSave) return
    const isManualSlug = Boolean(slugDraft.trim())
    const baseSlug = slug
    // Auto-suffix only when slug is auto-derived. Manual override preserves
    // the existing error-on-duplicate UX (isDuplicate hint).
    const finalSlug = isManualSlug
      ? baseSlug
      : withUniqueSuffix(baseSlug, characters, name)
    if (isManualSlug && isDuplicate) return
    const value = {
      slug: finalSlug,
      name: name.trim(),
      rawDescription: description.trim(),
      optimizedDescription: (acceptedText || optimized || '').trim(),
      createdAt: Date.now(),
    }
    setCharacters((prev) => {
      const next = { ...prev, [finalSlug]: value }
      // Opportunistic per-edit migration: if a kebab-equivalent of this snake
      // slug exists with the same name, remove the old kebab entry.
      const kebabEquivalent = finalSlug.replace(/_/g, '-')
      if (kebabEquivalent !== finalSlug && next[kebabEquivalent]?.name === value.name) {
        delete next[kebabEquivalent]
      }
      return next
    })
    const suffixApplied = finalSlug !== baseSlug
    setFlash(suffixApplied ? `Saved @${finalSlug} (auto-suffixed)` : `Saved @${finalSlug}`)
    setTimeout(() => setFlash(''), 1300)
  }

  const loadCharacter = (entry) => {
    setName(entry.name ?? '')
    setSlugDraft(entry.slug ?? '')
    setDescription(entry.rawDescription ?? '')
    setAcceptedText(entry.optimizedDescription ?? '')
    reset()
  }

  const removeCharacter = (entry) => {
    setCharacters((prev) => {
      const { [entry.slug]: _, ...rest } = prev
      return rest
    })
  }

  const copyToken = async (entry) => {
    try {
      await navigator.clipboard.writeText(`@${entry.slug}`)
      setFlash(`Copied @${entry.slug}`)
      setTimeout(() => setFlash(''), 1300)
    } catch {
      setFlash('Clipboard unavailable')
      setTimeout(() => setFlash(''), 1300)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.headerRow}>
          <h2>Character Builder</h2>
          <div className={styles.meta}>
            Engine: {aiEngine}
            {provider ? ` • provider: ${provider}` : ''}
            {fallback ? ` • fallback: ${fallback}` : ''}
          </div>
        </div>

        <label className={styles.label}>Character description</label>
        <textarea
          className={styles.textarea}
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe clothing, posture, face, props, materials..."
        />

        <div className={styles.row}>
          <button className={styles.btn} onClick={runOptimize} disabled={!description.trim() || state === 'loading'}>
            {state === 'loading' ? 'Optimizing...' : 'Optimize with AI'}
          </button>
          {error ? <span className={styles.error}>{error}</span> : null}
        </div>

        {optimized ? (
          <div className={styles.outputBox}>
            <div className={styles.label}>Optimized description</div>
            <p>{optimized}</p>
            <div className={styles.row}>
              <button className={styles.btn} onClick={() => setAcceptedText(optimized)}>Accept</button>
              <button className={styles.btnGhost} onClick={() => setAcceptedText('')}>Revert</button>
              <button className={styles.btnGhost} onClick={runOptimize}>Re-run</button>
            </div>
          </div>
        ) : null}

        <div className={styles.grid}>
          <div>
            <label className={styles.label}>Name</label>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ivan" />
          </div>
          <div>
            <label className={styles.label}>Slug</label>
            <input className={styles.input} value={slugDraft} onChange={(e) => setSlugDraft(e.target.value)} placeholder={slugAuto || 'auto-generated'} />
          </div>
        </div>
        <div className={styles.hint}>
          Use token <code>@{slug || 'your-slug'}</code> in Scene description.
          {isDuplicate ? <span className={styles.error}> Slug belongs to another character.</span> : null}
        </div>
        <div className={styles.row}>
          <button className={styles.btn} onClick={saveCharacter} disabled={!canSave || isDuplicate}>Save character</button>
          {flash ? <span className={styles.ok}>{flash}</span> : null}
        </div>
      </div>

      <div className={styles.card}>
        <h3>Saved characters</h3>
        {orderedCharacters.length === 0 ? (
          <p className={styles.empty}>No saved characters yet.</p>
        ) : (
          <div className={styles.list}>
            {orderedCharacters.map((entry) => (
              <div className={styles.item} key={entry.slug}>
                <div className={styles.itemTop}>
                  <strong>{entry.name}</strong>
                  <button className={styles.token} onClick={() => copyToken(entry)}>@{entry.slug}</button>
                </div>
                <p>{entry.optimizedDescription || entry.rawDescription}</p>
                <div className={styles.row}>
                  <button className={styles.btnGhost} onClick={() => loadCharacter(entry)}>Edit</button>
                  <button className={styles.btnGhost} onClick={() => removeCharacter(entry)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

