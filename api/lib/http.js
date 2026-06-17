export function sendJsonNode(res, status, payload) {
  if (typeof res?.status === 'function') {
    return res.status(status).json(payload)
  }
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

export function sendJsonMiddleware(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

export function getRequestQueryParam(req, key) {
  const direct = req?.query?.[key]
  if (typeof direct === 'string') return direct
  if (Array.isArray(direct) && typeof direct[0] === 'string') return direct[0]

  try {
    const url = new URL(req?.url || '', 'http://localhost')
    return url.searchParams.get(key) ?? undefined
  } catch {
    return undefined
  }
}

export async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  const raw = await readRawBody(req)
  const text = raw.toString()
  return text ? JSON.parse(text) : {}
}

export async function readMultipartForm(req) {
  const contentType = req.headers?.['content-type'] || ''
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2]
  if (!boundary) {
    const err = new Error('Missing multipart boundary')
    err.status = 400
    throw err
  }
  const raw = await readRawBody(req)
  const delimiter = Buffer.from(`--${boundary}`)
  const fields = {}
  const files = {}
  let start = raw.indexOf(delimiter)
  while (start >= 0) {
    const afterDelimiter = start + delimiter.length
    if (raw.slice(afterDelimiter, afterDelimiter + 2).equals(Buffer.from('--'))) break
    const partStart = afterDelimiter + (raw[afterDelimiter] === 13 && raw[afterDelimiter + 1] === 10 ? 2 : 0)
    const next = raw.indexOf(delimiter, partStart)
    const part = raw.slice(partStart, next >= 0 ? next - 2 : raw.length)
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))
    if (headerEnd >= 0) {
      const headerBlock = part.slice(0, headerEnd).toString('utf8')
      const body = part.slice(headerEnd + 4)
      const disposition = headerBlock.match(/Content-Disposition:[^\r\n]*/i)?.[0] || ''
      const nameMatch = /name="([^"]+)"/.exec(disposition)
      const filenameMatch = /filename="([^"]*)"/.exec(disposition)
      const name = nameMatch?.[1]
      if (name) {
        if (filenameMatch) {
          files[name] = { filename: filenameMatch[1], data: body }
        } else {
          fields[name] = body.toString('utf8')
        }
      }
    }
    if (next < 0) break
    start = next
  }
  return { fields, files }
}

export function normalizeHandlerError(error) {
  return {
    status: Number.isInteger(error?.status) ? error.status : 500,
    message: error?.message || 'Internal server error',
  }
}
