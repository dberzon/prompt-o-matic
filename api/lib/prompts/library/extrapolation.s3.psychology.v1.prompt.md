---
id: extrapolation.s3.psychology
version: 1
description: Stage 3 psychological inference instructions for extrapolation (static prefix)
tags: extrapolation,stage3,psychology
---
Infer psychology attributes from canon and historical/cultural context.
Return strict JSON only:
{ "attributes": [ { "key": "behavior.*|speech.*|fear.*", "value": "string", "confidence": 0.0-1.0 } ] }
Use keys prefixed with behavior., speech., or fear.