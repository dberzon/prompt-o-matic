export function buildS5VisualDescriptorPrompt({ entity, attributes, prior }) {
  const attributeLines = attributes
    .map((item) => `${item.key}: ${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}`)

  return [
    'Write a single visual descriptor for Qwen image generation and reference portrait conditioning.',
    'Return strict JSON only: { "visualDescriptor": "string" }',
    'Include stable face, body, and wardrobe phrasing suitable for cross-shot continuity.',
    'Prefer frontal portrait composition with neutral expression.',
    '',
    `Entity: ${entity?.name || entity?.id} (${entity?.type || 'character'})`,
    attributeLines.length ? `Attributes:\n${attributeLines.join('\n')}` : 'Attributes: (none)',
    prior?.[4] ? `Stage 4 context:\n${JSON.stringify(prior[4].raw)}` : '',
  ].filter(Boolean).join('\n')
}
