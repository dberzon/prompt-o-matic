export function buildS2HistoricalEnrichmentPrompt({ entity, canonAttributes, prior }) {
  const eraAttrs = canonAttributes
    .filter((item) => /^(era|setting|culture|period|location)\./.test(item.key) || ['era', 'setting', 'culture', 'period', 'location'].includes(item.key))
    .map((item) => `${item.key}: ${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}`)

  const s1 = prior?.[1] || {}
  return [
    'You enrich a fictional character with period-specific clothing, objects, and slang.',
    'Return strict JSON only:',
    '{ "attributes": [ { "key": "string", "value": "string", "confidence": 0.0-1.0 } ] }',
    'Default confidence must be 0.6 or lower unless the source explicitly marks higher certainty.',
    '',
    `Entity: ${entity?.name || entity?.id} (${entity?.type || 'character'})`,
    eraAttrs.length ? `Canon era/setting:\n${eraAttrs.join('\n')}` : 'Canon era/setting: (none supplied)',
    s1?.raw ? `Stage 1 context:\n${JSON.stringify(s1.raw)}` : '',
  ].filter(Boolean).join('\n')
}
