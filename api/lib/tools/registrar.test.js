import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  createRegistry,
  ToolInputValidationError,
  ToolNotFoundError,
  ToolOutputValidationError,
} from './registrar.js'
import { tool } from './tool.js'

describe('createRegistry', () => {
  const echo = tool({
    name: 'echo',
    description: 'returns input text',
    input: z.object({ text: z.string() }),
    output: z.object({ text: z.string() }),
    handler: ({ text }) => ({ text }),
  })

  it('invoke returns validated output on happy path', async () => {
    const reg = createRegistry({ tools: [echo] })
    const out = await reg.invoke('echo', { text: 'hi' })
    expect(out).toEqual({ text: 'hi' })
  })

  it('throws ToolInputValidationError with Zod issues on bad input', async () => {
    const reg = createRegistry({ tools: [echo] })
    await expect(reg.invoke('echo', { text: 1 })).rejects.toSatisfy(
      (e) => e instanceof ToolInputValidationError && e.issues?.length > 0 && e.toolName === 'echo',
    )
  })

  it('throws ToolOutputValidationError when handler output fails schema', async () => {
    const bad = tool({
      name: 'bad',
      description: 'bad output',
      input: z.object({}),
      output: z.object({ n: z.number() }),
      handler: () => ({ n: 'x' }),
    })
    const reg = createRegistry({ tools: [bad] })
    await expect(reg.invoke('bad', {})).rejects.toSatisfy(
      (e) => e instanceof ToolOutputValidationError && e.issues?.length > 0 && e.toolName === 'bad',
    )
  })

  it('throws ToolNotFoundError for unknown tool', async () => {
    const reg = createRegistry({ tools: [echo] })
    await expect(reg.invoke('missing', {})).rejects.toThrow(ToolNotFoundError)
  })

  it('throws when duplicate names are passed in tools array', () => {
    const a = tool({
      name: 'dup',
      description: 'a',
      input: z.object({}),
      output: z.object({}),
      handler: () => ({}),
    })
    const b = tool({
      name: 'dup',
      description: 'b',
      input: z.object({}),
      output: z.object({}),
      handler: () => ({}),
    })
    expect(() => createRegistry({ tools: [a, b] })).toThrow(/Duplicate tool name/)
  })
})
