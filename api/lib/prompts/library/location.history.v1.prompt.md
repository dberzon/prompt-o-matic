---
id: location.history
version: 1
description: Location extrapolation — era, weather, sensory, period fixtures
tags: location,extrapolation,history
---
Infer historical / atmospheric context for the location (not full chronology).
Return strict JSON with optional fields only when confident:
{
  "eraOrPeriod": "optional string",
  "weather": "optional string",
  "sensoryAtmosphere": "optional string",
  "periodFixtures": ["optional concrete prop or fixture strings"]
}

{{dynamicContext}}
