import { describe, expect, it } from 'vitest'
import { resolveCharacterSlug, toSnakeSlug, withUniqueSuffix } from './slugify.js'

describe('toSnakeSlug', () => {
  it('converts "Lena Sholk" to "lena_sholk"', () => {
    expect(toSnakeSlug('Lena Sholk')).toBe('lena_sholk')
  })

  it('converts kebab "lena-sholk" to "lena_sholk"', () => {
    expect(toSnakeSlug('lena-sholk')).toBe('lena_sholk')
  })

  it('leaves snake "lena_sholk" unchanged', () => {
    expect(toSnakeSlug('lena_sholk')).toBe('lena_sholk')
  })

  it('trims whitespace and punctuation', () => {
    expect(toSnakeSlug('  Lena   Sholk!  ')).toBe('lena_sholk')
  })

  it('returns empty string for empty-ish input', () => {
    expect(toSnakeSlug('')).toBe('')
    expect(toSnakeSlug(null)).toBe('')
    expect(toSnakeSlug(undefined)).toBe('')
    expect(toSnakeSlug('   ')).toBe('')
  })

  it('is idempotent', () => {
    const once = toSnakeSlug('  Lena   Sholk!  ')
    expect(toSnakeSlug(once)).toBe(once)
  })
})

describe('withUniqueSuffix', () => {
  it('returns base slug when no collision', () => {
    expect(withUniqueSuffix('lena_sholk', {}, 'Lena Sholk')).toBe('lena_sholk')
  })

  it('returns base slug when existing entry has same name', () => {
    const characters = { lena_sholk: { name: 'Lena Sholk' } }
    expect(withUniqueSuffix('lena_sholk', characters, 'Lena Sholk')).toBe('lena_sholk')
  })

  it('appends _2 when collision has different name', () => {
    const characters = { lena_sholk: { name: 'Different Person' } }
    expect(withUniqueSuffix('lena_sholk', characters, 'Lena Sholk')).toBe('lena_sholk_2')
  })

  it('appends _3 when _2 is taken with different name', () => {
    const characters = {
      lena_sholk: { name: 'Different Person' },
      lena_sholk_2: { name: 'Another Person' },
    }
    expect(withUniqueSuffix('lena_sholk', characters, 'Lena Sholk')).toBe('lena_sholk_3')
  })

  it('returns _2 when _2 has same name (edit case hole)', () => {
    const characters = {
      lena_sholk: { name: 'Different Person' },
      lena_sholk_2: { name: 'Lena Sholk' },
    }
    expect(withUniqueSuffix('lena_sholk', characters, 'Lena Sholk')).toBe('lena_sholk_2')
  })

  it('returns empty string for empty base slug', () => {
    expect(withUniqueSuffix('', { lena_sholk: { name: 'Lena' } }, 'Lena')).toBe('')
  })
})

describe('resolveCharacterSlug', () => {
  it('returns exact slug when present', () => {
    const characters = { lena_sholk: { name: 'Lena' } }
    expect(resolveCharacterSlug('lena_sholk', characters)).toBe('lena_sholk')
  })

  it('returns kebab equivalent when only kebab key exists and snake token is typed', () => {
    const characters = { 'lena-sholk': { name: 'Lena' } }
    expect(resolveCharacterSlug('lena_sholk', characters)).toBe('lena-sholk')
  })

  it('returns snake equivalent when only snake key exists and kebab token is typed', () => {
    const characters = { lena_sholk: { name: 'Lena' } }
    expect(resolveCharacterSlug('lena-sholk', characters)).toBe('lena_sholk')
  })

  it('returns null when neither form is present', () => {
    expect(resolveCharacterSlug('lena_sholk', {})).toBeNull()
  })

  it('lowercases input before lookup', () => {
    const characters = { lena_sholk: { name: 'Lena' } }
    expect(resolveCharacterSlug('LENA_SHOLK', characters)).toBe('lena_sholk')
  })
})
