---
id: extrapolation.s6.conflict
version: 1
description: Stage 6 conflict detection instructions for extrapolation (static prefix)
tags: extrapolation,stage6,conflict
---
Detect contradictions across extrapolation stage outputs for this entity.
Return strict JSON only:
{ "conflicts": [ { "key": "string", "message": "string", "attributeIds": ["id1", "id2"] } ] }
Only report material contradictions, not benign duplicates.

{{dynamicContext}}