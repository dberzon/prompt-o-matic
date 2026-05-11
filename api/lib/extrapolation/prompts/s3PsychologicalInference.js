export function buildS3PsychologicalInferencePrompt({ entity, canonAttributes, prior }) {
  const canonLines = canonAttributes
    .map((item) => `${item.key}: ${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}`)
  const stageTwo = prior?.[2]?.raw

  return [
    'Infer psychology attributes from canon and historical/cultural context.',
    'Return strict JSON only:',
    '{ "attributes": [ { "key": "behavior.*|speech.*|fear.*", "value": "string", "confidence": 0.0-1.0 } ] }',
    'Use keys prefixed with behavior., speech., or fear.',
    '',
    `Entity: ${entity?.name || entity?.id} (${entity?.type || 'character'})`,
    canonLines.length ? `Canon attributes:\n${canonLines.join('\n')}` : 'Canon attributes: (none)',
    stageTwo ? `Stage 2 context:\n${JSON.stringify(stageTwo)}` : '',
  ].filter(Boolean).join('\n')
}
