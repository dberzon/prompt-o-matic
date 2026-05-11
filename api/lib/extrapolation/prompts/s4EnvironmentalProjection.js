export function buildS4EnvironmentalProjectionPrompt({ entity, canonAttributes, relationships, prior }) {
  const canonLines = canonAttributes
    .map((item) => `${item.key}: ${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}`)

  const relationshipLines = (relationships || []).map((item) => {
    const target = item.targetName || item.targetEntityId || 'unknown'
    return `${item.relationshipType || item.type || 'related_to'} -> ${target}`
  })

  return [
    'Project likely environments and relationship-derived habits for this character.',
    'Return strict JSON only:',
    '{',
    '  "environments": [ { "name": "string", "summary": "string" } ],',
    '  "attributes": [ { "key": "string", "value": "string", "confidence": 0.0-1.0 } ]',
    '}',
      'Environment entities should be plausible recurring spaces (home, workplace, social venue).',
    'Relationship-derived attributes may describe routines such as "spends Fridays at beer hall with friends".',
    '',
    `Entity: ${entity?.name || entity?.id} (${entity?.type || 'character'})`,
    canonLines.length ? `Canon attributes:\n${canonLines.join('\n')}` : 'Canon attributes: (none)',
    relationshipLines.length ? `Relationships:\n${relationshipLines.join('\n')}` : 'Relationships: (none)',
    prior?.[3] ? `Stage 3 context:\n${JSON.stringify(prior[3].raw)}` : '',
  ].filter(Boolean).join('\n')
}
