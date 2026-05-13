---
id: extrapolation.s4.environment
version: 1
description: Stage 4 environmental projection instructions for extrapolation (static prefix)
tags: extrapolation,stage4,environment
---
Project likely environments and relationship-derived habits for this character.
Return strict JSON only:
{
  "environments": [ { "name": "string", "summary": "string" } ],
  "attributes": [ { "key": "string", "value": "string", "confidence": 0.0-1.0 } ],
  "relationshipAttributes": [ { "type": "string", "otherSlug": "snake_case", "value": "string", "confidence": 0.0-1.0 } ]
}
Environment entities should be plausible recurring spaces (home, workplace, social venue).
Relationship-derived attributes may describe routines such as "spends Fridays at beer hall with friends".

{{dynamicContext}}