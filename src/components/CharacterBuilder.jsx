import { useEffect, useMemo, useState, useCallback } from 'react'
import { useCharacterOptimize } from '../hooks/useCharacterOptimize.js'
import { listBankEntries, createBankEntry, updateBankEntry, deleteBankEntry } from '../lib/api/characterBank.js'
import { toSnakeSlug, withUniqueSuffix } from '../utils/slugify.js'
import styles from './CharacterBuilder.module.css'

function readLocalSetting(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return typeof raw === 'string' && raw.trim() ? raw.trim() : fallback
  } catch {
    return fallback
  }
}

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
  const [flashIsError, setFlashIsError] = useState(false)
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
  const [saving, setSaving] = useState(false)

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
        // DB is the authority — overwrite localStorage cache with DB values.
        if (items.length > 0) {
          setCharacters((prev) => {
            const merged = { ...prev }
            for (const bankEntry of items) {
              merged[bankEntry.slug] = {
                slug: bankEntry.slug,
                name: bankEntry.name,
                rawDescription: bankEntry.description,
                optimizedDescription: bankEntry.optimizedDescription || '',
                createdAt: new Date(bankEntry.createdAt).getTime(),
              }
            }
            return merged
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

  const runOptimize = useCallback(async () => {
    const localProvider = readLocalSetting('qpb_local_provider_v1', 'ollama')
    const lmStudioHost = readLocalSetting('qpb_lmstudio_host_v1', '127.0.0.1')
    const lmStudioPort = readLocalSetting('qpb_lmstudio_port_v1', '1234')
    const lmStudioModel = readLocalSetting('qpb_lmstudio_model_v1', 'qwen-local')
    const lmStudioBaseUrl = localProvider === 'lmstudio'
      ? `http://${lmStudioHost}:${lmStudioPort}/v1`
      : null
    await optimize({
      description,
      engine: aiEngine,
      localOnly,
      embeddedPort: embeddedStatus?.port ?? null,
      embeddedSecret: embeddedStatus?.secret ?? null,
      embeddedModel: embeddedStatus?.modelId ?? null,
      localProvider,
      lmStudioBaseUrl,
      lmStudioModel: localProvider === 'lmstudio' ? lmStudioModel : null,
    })
  }, [description, aiEngine, localOnly, embeddedStatus, optimize])

  const saveCharacter = async () => {
    if (!canSave || saving) return
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
    setSaving(true)
    setFlash('')
    setFlashIsError(false)
    try {
      const desc = (value.rawDescription || value.optimizedDescription || '').trim()
      if (!desc) throw new Error('Description is required')
      const existing = bankEntries.find((e) => e.slug === finalSlug)
      let result
      if (existing) {
        result = await updateBankEntry(existing.id, {
          name: value.name,
          description: desc,
          optimizedDescription: value.optimizedDescription || undefined,
        })
        setBankEntries((prev) => prev.map((e) => (e.id === existing.id ? result.item : e)))
      } else {
        result = await createBankEntry({
          slug: finalSlug,
          name: value.name,
          description: desc,
          optimizedDescription: value.optimizedDescription || undefined,
        })
        setBankEntries((prev) => [...prev, result.item])
      }
      // DB write succeeded — cache to localStorage.
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
      setBankSyncStatus((prev) => ({ ...prev, [finalSlug]: 'synced' }))
      setBankSyncError((prev) => ({ ...prev, [finalSlug]: null }))
      const suffixApplied = finalSlug !== baseSlug
      setFlash(suffixApplied ? `Saved @${finalSlug} (auto-suffixed)` : `Saved @${finalSlug}`)
      setFlashIsError(false)
      setTimeout(() => setFlash(''), 1300)
    } catch (err) {
      const message = err?.code === 'SLUG_COLLISION'
        ? 'Slug already in bank under a different character'
        : (err?.message || 'Save failed')
      setFlash(`Save failed: ${message}`)
      setFlashIsError(true)
    } finally {
      setSaving(false)
    }
  }

  const loadCharacter = (entry) => {
    setName(entry.name ?? '')
    setSlugDraft(entry.slug ?? '')
    setDescription(entry.rawDescription ?? '')
    setAcceptedText(entry.optimizedDescription ?? '')
    reset()
  }

  const removeCharacter = async (entry) => {
    const bankEntry = bankEntries.find((e) => e.slug === entry.slug)
    if (bankEntry) {
      try {
        await deleteBankEntry(bankEntry.id)
        setBankEntries((prev) => prev.filter((e) => e.id !== bankEntry.id))
      } catch (err) {
        setFlash(`Delete failed: ${err?.message || 'API error'}`)
        setFlashIsError(true)
        return
      }
    }
    setCharacters((prev) => {
      const { [entry.slug]: _, ...rest } = prev
      return rest
    })
    setBankSyncStatus((prev) => {
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
          <button className={styles.btn} onClick={saveCharacter} disabled={!canSave || isDuplicate || saving}>
            {saving ? 'Saving…' : 'Save character'}
          </button>
          {flash ? <span className={flashIsError ? styles.error : styles.ok}>{flash}</span> : null}
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

