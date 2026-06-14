/**
 * Maps entity attribute keys (as stored by extrapolation / S1) to Character Bible dot-paths.
 * Keys not listed here are used as-is when they already match a valid Bible subtree path
 * (e.g. `demographics.gender` → `demographics.gender`).
 *
 * @typedef {Record<string, string>} AttributePathMap
 */

/** @type {AttributePathMap} */
export const CHARACTER_ENTITY_KEY_TO_BIBLE_PATH = {
  description: 'visuals.portraitBrief',
  'demographics.age': 'demographics.ageRange',
  'setting.era': 'demographics.eraLabel',
  'home.housingNotes': 'demographics.housingNotes',
  'appearance.height': 'physical.height',
  'appearance.build': 'physical.build',
  'appearance.face': 'physical.face',
  'appearance.faceShape': 'physical.face',
  'appearance.eyes': 'physical.eyes',
  'appearance.nose': 'physical.nose',
  'appearance.lips': 'physical.lips',
  'appearance.skin': 'physical.skin',
  'eyes': 'physical.eyes',
  'visual.descriptor': 'visuals.portraitBrief',
  'visual.continuityKeywords': 'visuals.continuityKeywords',
  'history.biography': 'history.biographySummary',
  'psychology.temperament': 'psychology.temperament',
  'psychology.motivations': 'psychology.motivations',
  'behavior.temperament': 'psychology.temperament',
  'speech.accent': 'voice.accentOrDiction',
  'speech.delivery': 'voice.dialogueDeliveryNotes',
}

/** @type {AttributePathMap} */
export const LOCATION_ENTITY_KEY_TO_BIBLE_PATH = {
  name: 'identity.name',
  description: 'identity.summary',
  summary: 'identity.summary',
  'setting.era': 'identity.eraOrPeriod',
  'identity.era': 'identity.eraOrPeriod',
}

/** @type {AttributePathMap} */
export const ERA_ENTITY_KEY_TO_BIBLE_PATH = {
  label: 'identity.label',
  'identity.name': 'identity.label',
  span: 'timeframe.spanDescription',
  'timeframe.label': 'timeframe.spanDescription',
}

/** @type {AttributePathMap} */
export const PROP_ENTITY_KEY_TO_BIBLE_PATH = {
  name: 'identity.label',
  description: 'identity.summary',
  summary: 'identity.summary',
  purpose: 'function.purposeInStory',
  notes: 'visuals.continuityNotes',
}

/**
 * @param {AttributePathMap} map
 * @param {string} entityKey
 * @returns {string}
 */
export function resolveBiblePath(map, entityKey) {
  if (map[entityKey]) return map[entityKey]
  return entityKey
}
