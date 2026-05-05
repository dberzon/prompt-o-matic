export async function fetchSavedPrompts() {
  const res = await fetch('/api/saved-prompts')
  if (!res.ok) throw new Error('Failed to load saved prompts')
  return (await res.json()).items ?? []
}

export async function createSavedPromptRemote({ id, name, text }) {
  const res = await fetch('/api/saved-prompts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, text }),
  })
  if (!res.ok) throw new Error('Failed to save prompt')
  return (await res.json()).item
}

export async function deleteSavedPromptRemote(id) {
  const res = await fetch(`/api/saved-prompts?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete prompt')
}

export async function renameSavedPromptRemote(id, name) {
  const res = await fetch('/api/saved-prompts', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name }),
  })
  if (!res.ok) throw new Error('Failed to rename prompt')
  return (await res.json()).item
}

export async function fetchWorkspaceProfiles() {
  const res = await fetch('/api/workspace-profiles')
  if (!res.ok) throw new Error('Failed to load workspace profiles')
  return (await res.json()).items ?? []
}

export async function upsertWorkspaceProfileRemote({ id, label, state }) {
  const res = await fetch('/api/workspace-profiles', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, label, state }),
  })
  if (!res.ok) throw new Error('Failed to save workspace profile')
  return (await res.json()).item
}

export async function deleteWorkspaceProfileRemote(id) {
  const res = await fetch(`/api/workspace-profiles?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete workspace profile')
}
