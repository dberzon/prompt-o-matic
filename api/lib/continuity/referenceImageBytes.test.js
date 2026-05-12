import { describe, expect, it } from 'vitest'
import { referenceImageMimeFromBytes, validateReferenceImageBytes } from './referenceImageBytes.js'

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])

describe('referenceImageBytes', () => {
  it('detects supported image signatures', () => {
    expect(referenceImageMimeFromBytes(PNG_BYTES)).toBe('image/png')
    expect(referenceImageMimeFromBytes(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg')
  })

  it('rejects invalid payloads', () => {
    expect(() => validateReferenceImageBytes(Buffer.from('not-an-image'))).toThrow(/Unsupported or invalid image format/)
    expect(() => validateReferenceImageBytes(Buffer.alloc(0))).toThrow(/Missing or empty image payload/)
  })

  it('accepts valid reference image bytes', () => {
    expect(validateReferenceImageBytes(PNG_BYTES)).toBe(PNG_BYTES)
  })
})
