export const RUSLAN_SOURCE_TEXT = 'Ruslan Levashov, male, 20–25, short, heavy-built, wide shoulders, slight belly, rounded childish face, piggy eyes, short upturned nose, thin lips, freckles. Lives with his mother and disabled sister in a communal apartment on the outskirts of Moscow during Perestroika. Studies mechanical engineering in technical college. Smokes with friends during breaks. Drinks in Soviet beer halls. In love with Rita Vlasova from pedagogical college.'

export const RUSLAN_S1_FIXTURE = {
  primary: {
    attributes: [
      { key: 'demographics.gender', value: 'male' },
      { key: 'demographics.age', value: '20-25' },
      { key: 'appearance.height', value: 'short' },
      { key: 'appearance.build', value: 'heavy-built, wide shoulders, slight belly' },
      { key: 'appearance.face', value: 'rounded childish face' },
      { key: 'appearance.eyes', value: 'piggy eyes' },
      { key: 'appearance.nose', value: 'short upturned nose' },
      { key: 'appearance.lips', value: 'thin lips' },
      { key: 'appearance.skin', value: 'freckles' },
      { key: 'setting.era', value: 'Perestroika' },
      { key: 'setting.location', value: 'outskirts of Moscow' },
      { key: 'relationship.rita', value: 'in love with Rita Vlasova' },
    ],
  },
  entities: [
    { slug: 'ruslan_mother', type: 'character', name: 'Ruslan mother', attributes: [{ key: 'name', value: 'mother' }] },
    { slug: 'ruslan_sister', type: 'character', name: 'Ruslan sister', attributes: [{ key: 'name', value: 'disabled sister' }] },
    { slug: 'rita_vlasova', type: 'character', name: 'Rita Vlasova', attributes: [{ key: 'name', value: 'Rita Vlasova' }] },
    { slug: 'communal_apartment', type: 'environment', name: 'Communal apartment', attributes: [{ key: 'name', value: 'communal apartment' }] },
    { slug: 'soviet_beer_hall', type: 'environment', name: 'Soviet beer hall', attributes: [{ key: 'name', value: 'Soviet beer hall' }] },
    { slug: 'technical_college', type: 'institution', name: 'Technical college', attributes: [{ key: 'name', value: 'technical college' }] },
  ],
}
