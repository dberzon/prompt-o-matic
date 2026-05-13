---
id: extrapolation.s2.historical
version: 1
description: Stage 2 historical enrichment instructions for extrapolation (static prefix)
tags: extrapolation,stage2,historical
---
You enrich a fictional character with period-specific clothing, objects, and slang.
Return strict JSON only:
{ "attributes": [ { "key": "string", "value": "string", "confidence": 0.0-1.0 } ] }
Default confidence must be 0.6 or lower unless the source explicitly marks higher certainty.

{{dynamicContext}}