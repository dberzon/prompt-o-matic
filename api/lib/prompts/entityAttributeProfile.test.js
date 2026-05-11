import { describe, expect, it } from 'vitest'
import {
  entityAttributesToProfile,
  selectAttributesForPromptPack,
  selectAttributesForReferencePortrait,
} from './entityAttributeProfile.js'

describe('entity attribute profile', () => {
  it('selects canon over inferred for the same key', () => {
    const selected = selectAttributesForPromptPack([
      { key: 'eyes', value: 'blue', provenance: 'inferred' },
      { key: 'eyes', value: 'green', provenance: 'canon' },
    ])
    expect(selected.get('eyes').value).toBe('green')
  })

  it('ignores suggested and unscoped derived attributes', () => {
    const selected = selectAttributesForPromptPack([
      { key: 'eyes', value: 'green', provenance: 'canon' },
      { key: 'mood', value: 'sad', provenance: 'suggested' },
      { key: 'ally', value: 'Rita', provenance: 'derived' },
    ])
    expect([...selected.keys()]).toEqual(['eyes'])
  })

  it('includes scoped relationship-derived attributes', () => {
    const selected = selectAttributesForPromptPack([
      { key: 'eyes', value: 'green', provenance: 'canon' },
      { key: 'relation.in_love_with:rita_vlasova', value: 'in love with Rita Vlasova', provenance: 'derived' },
    ], { scopeEntityIds: ['rita_vlasova'] })
    expect([...selected.keys()].sort()).toEqual(['eyes', 'relation.in_love_with:rita_vlasova'])
  })

  it('keeps visual.descriptor and facial attrs for reference portrait selection', () => {
    const selected = selectAttributesForReferencePortrait([
      { key: 'eyes', value: 'green', provenance: 'canon' },
      { key: 'eyes', value: 'blue', provenance: 'inferred' },
      { key: 'wardrobe', value: 'worn wool coat', provenance: 'inferred' },
      { key: 'visual.descriptor', value: 'frontal portrait, neutral expression', provenance: 'inferred' },
      { key: 'mood', value: 'sad', provenance: 'suggested' },
    ])
    expect([...selected.keys()].sort()).toEqual(['eyes', 'visual.descriptor'])
    expect(selected.get('eyes').value).toBe('green')
    expect(selected.get('visual.descriptor').value).toBe('frontal portrait, neutral expression')
  })

  it('maps known keys and visual.descriptor into the profile', () => {
    const selected = selectAttributesForPromptPack([
      { key: 'eyes', value: 'hazel almond eyes', provenance: 'canon' },
      { key: 'wardrobe', value: 'worn wool coat', provenance: 'inferred' },
      { key: 'visual.descriptor', value: 'frontal portrait, neutral expression', provenance: 'inferred' },
      { key: 'speech.register', value: 'quiet and clipped', provenance: 'inferred' },
    ])
    const { profile, visualDescriptor, extraContext } = entityAttributesToProfile(
      { id: 'ent_001', type: 'character', name: 'Ruslan' },
      selected,
    )
    expect(profile.name).toBe('Ruslan')
    expect(profile.eyes).toBe('hazel almond eyes')
    expect(profile.wardrobeBase).toBe('worn wool coat')
    expect(visualDescriptor).toBe('frontal portrait, neutral expression')
    expect(extraContext).toEqual(['speech.register: quiet and clipped'])
  })
})
