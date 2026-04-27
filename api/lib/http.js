export function sendJsonNode(res, status, payload) {
  res.status(status).json(payload)
}

export function sendJsonMiddleware(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString()
  return raw ? JSON.parse(raw) : {}
}

export function normalizeHandlerError(error) {
  return {
    status: Number.isInteger(error?.status) ? error.status : 500,
    message: error?.message || 'Internal server error',
  }
}
