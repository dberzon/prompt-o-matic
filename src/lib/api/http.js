function buildQuery(query = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

function normalizeError(status, payload) {
  const baseMessage = payload?.error || `Request failed with status ${status}`
  if (status === 403) {
    return `${baseMessage} (Likely missing required ENABLE_* env flag for this endpoint.)`
  }
  return baseMessage
}

async function request(method, path, payload, query) {
  const response = await fetch(`${path}${buildQuery(query)}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  })
  let data = {}
  try {
    data = await response.json()
  } catch {
    data = {}
  }
  if (!response.ok) {
    const error = new Error(normalizeError(response.status, data))
    error.status = response.status
    error.code = data?.code || 'API_ERROR'
    error.payload = data
    throw error
  }
  return data
}

export function apiGet(path, query) {
  return request('GET', path, null, query)
}

export function apiPost(path, payload) {
  return request('POST', path, payload)
}

export function apiPut(path, payload) {
  return request('PUT', path, payload)
}

