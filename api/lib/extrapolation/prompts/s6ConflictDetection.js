export function buildS6ConflictDetectionPrompt({ entity, attributes, prior }) {
  const attributeLines = attributes
    .map((item) => `${item.id} :: ${item.key} :: ${item.provenance} :: ${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}`)

  return [
    'Detect contradictions across extrapolation stage outputs for this entity.',
    'Return strict JSON only:',
    '{ "conflicts": [ { "key": "string", "message": "string", "attributeIds": ["id1", "id2"] } ] }',
    'Only report material contradictions, not benign duplicates.',
    '',
    `Entity: ${entity?.name || entity?.id} (${entity?.type || 'character'})`,
    attributeLines.length ? `Active attributes:\n${attributeLines.join('\n')}` : 'Active attributes: (none)',
    prior ? `Prior stage outputs:\n${JSON.stringify(prior)}` : '',
  ].filter(Boolean).join('\n')
}
