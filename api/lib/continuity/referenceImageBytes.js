const MAX_REFERENCE_IMAGE_BYTES = 7_000_000

const SIGNATURES = [
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
]

function matchesSignature(payload, { bytes, offset = 0 }) {
  if (payload.length < offset + bytes.length) return false
  return bytes.every((byte, index) => payload[offset + index] === byte)
}

export function referenceImageMimeFromBytes(payload) {
  if (!Buffer.isBuffer(payload) || payload.length === 0) return null
  for (const signature of SIGNATURES) {
    if (matchesSignature(payload, signature)) return signature.mime
  }
  if (matchesSignature(payload, { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] })
    && matchesSignature(payload, { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] })) {
    return 'image/webp'
  }
  return null
}

export function validateReferenceImageBytes(payload) {
  if (!Buffer.isBuffer(payload) || payload.length === 0) {
    const err = new Error('Missing or empty image payload')
    err.status = 400
    throw err
  }
  if (payload.length > MAX_REFERENCE_IMAGE_BYTES) {
    const err = new Error('Image too large — please use an image under ~5MB')
    err.status = 413
    throw err
  }
  if (!referenceImageMimeFromBytes(payload)) {
    const err = new Error('Unsupported or invalid image format')
    err.status = 400
    throw err
  }
  return payload
}
