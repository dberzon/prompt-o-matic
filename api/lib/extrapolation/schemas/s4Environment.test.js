import { describe, expect, it } from 'vitest'
import { S4EnvironmentOutputSchema, parseS4EnvironmentOutput } from './s4Environment.js'

describe('S4EnvironmentOutputSchema', () => {
  const happy = {
    environments: [{ name: 'Communal apartment', summary: 'Shared kitchen' }],
    attributes: [{ key: 'home.context', value: 'lives in communal apartment' }],
  }

  it('parses orchestrator happy-path fixture', () => {
    const parsed = parseS4EnvironmentOutput(happy)
    expect(parsed.environments).toHaveLength(1)
    expect(parsed.attributes?.[0].key).toBe('home.context')
  })

  it('accepts relationshipAttributes-only payload with empty environments', () => {
    const parsed = parseS4EnvironmentOutput({
      environments: [],
      relationshipAttributes: [
        { type: 'romantic.crush', otherSlug: 'rita_vlasova', value: 'in love' },
      ],
    })
    expect(parsed.relationshipAttributes).toHaveLength(1)
  })

  it('accepts environments-only payload', () => {
    const parsed = parseS4EnvironmentOutput({
      environments: [{ name: 'Beer hall', summary: 'Friday hangout' }],
    })
    expect(parsed.environments[0].name).toBe('Beer hall')
    expect(parsed.attributes).toBeUndefined()
  })
})
