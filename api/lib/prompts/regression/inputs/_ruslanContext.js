import {
  RUSLAN_S1_FIXTURE,
  RUSLAN_SOURCE_TEXT,
} from '../../../extrapolation/fixtures/ruslanWorkedExample.js'

export const RUSLAN_ENTITY = {
  id: 'ruslan_levashov',
  name: 'Ruslan Levashov',
  type: 'character',
}

/** Canon attributes seeded from the Ruslan worked example (S1 output shape). */
export const RUSLAN_CANON_ATTRIBUTES = RUSLAN_S1_FIXTURE.primary.attributes.map(({ key, value }) => ({
  key,
  value,
}))

export const RUSLAN_RELATIONSHIPS = [
  {
    relationshipType: 'in_love_with',
    targetName: 'Rita Vlasova',
    targetEntityId: 'rita_vlasova',
  },
]

/** Prior stage raw payloads in orchestrator `ctx.prior` shape. */
export const RUSLAN_PRIOR = {
  1: { raw: RUSLAN_S1_FIXTURE },
  2: {
    raw: {
      attributes: [
        { key: 'culture.period', value: 'Perestroika-era Moscow outskirts', confidence: 0.9 },
        { key: 'culture.housing', value: 'communal apartment block', confidence: 0.85 },
      ],
    },
  },
  3: {
    raw: {
      attributes: [
        { key: 'psychology.temperament', value: 'affable, slightly awkward', confidence: 0.8 },
        { key: 'psychology.social', value: 'seeks approval from peers', confidence: 0.75 },
      ],
    },
  },
  4: {
    raw: {
      environments: [{ name: 'Soviet beer hall', summary: 'Friday hangout with classmates' }],
      attributes: [{ key: 'routine.social', value: 'smokes with friends during college breaks' }],
    },
  },
}

/** Active attributes for S5/S6 (canon + inferred mix with stable ids). */
export const RUSLAN_ACTIVE_ATTRIBUTES = [
  ...RUSLAN_CANON_ATTRIBUTES.map((item, index) => ({
    id: `attr_canon_${index + 1}`,
    key: item.key,
    value: item.value,
    provenance: 'canon',
  })),
  {
    id: 'attr_inferred_1',
    key: 'visual.descriptor',
    value: 'stocky young man, rounded face, freckled skin, short dark hair',
    provenance: 'inferred',
  },
  {
    id: 'attr_inferred_2',
    key: 'behavior.temperament',
    value: 'affable, slightly awkward',
    provenance: 'inferred',
  },
]

export const RUSLAN_S1_SOURCE_TEXT = RUSLAN_SOURCE_TEXT
