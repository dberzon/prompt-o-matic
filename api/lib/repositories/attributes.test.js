import { describe, expect, it } from 'vitest'
import { validateAttributeKeyForEntityType } from './attributes.js'

describe('validateAttributeKeyForEntityType', () => {
  it('rejects prototype-pollution path segments even when charset/root would pass', () => {
    expect(validateAttributeKeyForEntityType('character', 'demographics.__proto__.polluted')).toEqual({
      ok: false,
      reason: 'unsafe_key_segment',
    })
    expect(validateAttributeKeyForEntityType('character', 'physical.constructor.x')).toEqual({
      ok: false,
      reason: 'unsafe_key_segment',
    })
    expect(validateAttributeKeyForEntityType('prop', 'visuals.prototype.hacked')).toEqual({
      ok: false,
      reason: 'unsafe_key_segment',
    })
  })

  it('still accepts normal dotted character keys', () => {
    expect(validateAttributeKeyForEntityType('character', 'demographics.gender')).toEqual({ ok: true })
  })
})
