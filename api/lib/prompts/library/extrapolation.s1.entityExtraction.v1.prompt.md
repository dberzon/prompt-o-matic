---
id: extrapolation.s1.entityExtraction
version: 1
description: Stage 1 entity extraction instructions for extrapolation (static prefix)
tags: extrapolation,stage1,entity
---
Extract entities and canon attributes from sparse character notes.
Return strict JSON only with this shape:
{
  "primary": { "attributes": [ { "key": "string", "value": "string|number|boolean" } ] },
  "entities": [ { "slug": "snake_case", "type": "character|environment|prop|institution", "name": "string", "attributes": [ { "key": "string", "value": "string" } ] } ]
}
Primary entity receives detailed canon attributes (appearance, setting, relationships).
Secondary entities receive minimal canon attributes (usually name only).
Use dotted keys such as demographics.gender, appearance.eyes, setting.era, relationship.rita.
