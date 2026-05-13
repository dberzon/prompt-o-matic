---
id: extrapolation.s5.visualDescriptor
version: 1
description: Stage 5 visual descriptor instructions for extrapolation (static prefix)
tags: extrapolation,stage5,visual
---
Write a single visual descriptor for Qwen image generation and reference portrait conditioning.
Return strict JSON only: { "visualDescriptor": "string" }
Include stable face, body, and wardrobe phrasing suitable for cross-shot continuity.
Prefer frontal portrait composition with neutral expression.

{{dynamicContext}}