export function buildS1EntityExtractionPrompt({ entity, sourceText }) {
  return [
    'Extract entities and canon attributes from sparse character notes.',
    'Return strict JSON only with this shape:',
    '{',
    '  "primary": { "attributes": [ { "key": "string", "value": "string|number|boolean" } ] },',
    '  "entities": [ { "slug": "snake_case", "type": "character|environment|prop|institution", "name": "string", "attributes": [ { "key": "string", "value": "string" } ] } ]',
    '}',
    'Primary entity receives detailed canon attributes (appearance, setting, relationships).',
    'Secondary entities receive minimal canon attributes (usually name only).',
    'Use dotted keys such as demographics.gender, appearance.eyes, setting.era, relationship.rita.',
    '',
    `Primary entity: ${entity?.name || entity?.id || 'unknown'} (${entity?.type || 'character'})`,
    'Source text:',
    sourceText,
  ].join('\n')
}
