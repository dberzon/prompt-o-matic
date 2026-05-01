import { useEffect, useMemo, useState } from 'react'
import { useCharacterOptimize } from '../hooks/useCharacterOptimize.js'
import { listBankEntries, createBankEntry, updateBankEntry } from '../lib/api/characterBank.js'
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
  const [bankEntries, setBankEntries] = useState([])
  const [bankSyncStatus, setBankSyncStatus] = useState({})
  const [bankSyncError, setBankSyncError] = useState({})

  useEffect(() => {
    let cancelled = false
    listBankEntries()
      .then((data) => {
        if (cancelled) return
        const items = Array.isArray(data?.items) ? data.items : []
        setBankEntries(items)
        const initialStatus = {}
        for (const slug of Object.keys(characters)) {
          if (items.some((e) => e.slug === slug)) {
            initialStatus[slug] = 'synced'
          }
        }
        setBankSyncStatus((prev) => ({ ...initialStatus, ...prev }))
        // Pull bank entries not present in localStorage (DB is source of truth).
        if (items.length > 0) {
          setCharacters((prev) => {
            const merged = { ...prev }
            let changed = false
            for (const bankEntry of items) {
              if (!merged[bankEntry.slug]) {
                merged[bankEntry.slug] = {
                  slug: bankEntry.slug,
                  name: bankEntry.name,
                  rawDescription: bankEntry.description,
                  optimizedDescription: bankEntry.optimizedDescription || '',
                  createdAt: new Date(bankEntry.createdAt).getTime(),
                }
                changed = true
              }
            }
            return changed ? merged : prev
          })
        }
      })
      .catch(() => {
        // Bank unavailable (e.g. APP_MODE=cloud or dev server not running).
        // Sync UI stays in idle state; local-only flow continues to work.
      })
    return () => { cancelled = true }
  }, [])

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
    // Best-effort background sync to DB. Failures are silent — localStorage
    // remains the fallback if the bank is unreachable.
    syncCharacter(value)
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

  const syncCharacter = async (entry) => {
    const slug = entry.slug
    setBankSyncStatus((prev) => ({ ...prev, [slug]: 'syncing' }))
    setBankSyncError((prev) => ({ ...prev, [slug]: null }))
    try {
      const description = (entry.rawDescription || entry.optimizedDescription || '').trim()
      if (!description) {
        throw new Error('Cannot sync: description is empty')
      }
      const optimizedDescription = (entry.optimizedDescription || '').trim()
      const existing = bankEntries.find((e) => e.slug === slug)
      let result
      if (existing) {
        result = await updateBankEntry(existing.id, {
          name: entry.name,
          description,
          optimizedDescription: optimizedDescription || undefined,
        })
        setBankEntries((prev) => prev.map((e) => (e.id === existing.id ? result.item : e)))
      } else {
        result = await createBankEntry({
          slug,
          name: entry.name,
          description,
          optimizedDescription: optimizedDescription || undefined,
        })
        setBankEntries((prev) => [...prev, result.item])
      }
      setBankSyncStatus((prev) => ({ ...prev, [slug]: 'synced' }))
    } catch (err) {
      const message = err?.code === 'SLUG_COLLISION'
        ? 'Slug already in bank under a different character'
        : (err?.message || 'Sync failed')
      setBankSyncStatus((prev) => ({ ...prev, [slug]: 'error' }))
      setBankSyncError((prev) => ({ ...prev, [slug]: message }))
    }
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
                  <button
                    className={styles.btnGhost}
                    onClick={() => syncCharacter(entry)}
                    disabled={bankSyncStatus[entry.slug] === 'syncing'}
                  >
                    {bankSyncStatus[entry.slug] === 'synced' ? '✓ Synced' : 'Sync'}
                  </button>
                  {bankSyncStatus[entry.slug] === 'syncing' ? (
                    <span className={styles.empty}>Syncing…</span>
                  ) : null}
                  {bankSyncStatus[entry.slug] === 'error' ? (
                    <span className={styles.error}>{bankSyncError[entry.slug] || 'Sync failed'}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

