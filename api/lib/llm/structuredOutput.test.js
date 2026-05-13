import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { LlmStructuredError } from './errors.js'
import { callWithSchema } from './structuredOutput.js'

describe('callWithSchema', () => {
  const baseOpts = {
    promptId: 'test.prompt',
    schema: z.object({ a: z.number() }),
  }

  it('returns typed data when the first response is valid JSON', async () => {
    const chat = vi.fn().mockResolvedValue('  {"a": 1}  \n')
    const client = { chat }
    const out = await callWithSchema({ ...baseOpts, client, maxRetries: 1 })
    expect(out).toEqual({ a: 1 })
    expect(chat).toHaveBeenCalledTimes(1)
    expect(chat.mock.calls[0][0]).toMatchObject({ promptId: 'test.prompt', variables: {} })
  })

  it('retries once when JSON is invalid then succeeds', async () => {
    const chat = vi.fn().mockResolvedValueOnce('not-json').mockResolvedValueOnce('{"a":2}')
    const client = { chat }
    const out = await callWithSchema({ ...baseOpts, client, maxRetries: 1 })
    expect(out).toEqual({ a: 2 })
    expect(chat).toHaveBeenCalledTimes(2)
    expect(chat.mock.calls[1][0].variables).toMatchObject({
      structuredOutputRepair: { rawText: 'not-json', issues: expect.any(Array) },
    })
  })

  it('throws LlmStructuredError after invalid JSON on both attempts', async () => {
    const chat = vi.fn().mockResolvedValue('nope')
    const client = { chat }
    await expect(callWithSchema({ ...baseOpts, client, maxRetries: 1 })).rejects.toMatchObject({
      name: 'LlmStructuredError',
      rawText: 'nope',
      issues: expect.any(Array),
    })
    expect(chat).toHaveBeenCalledTimes(2)
  })

  it('invokes onDrop for invalid array elements then returns valid items', async () => {
    const schema = z.array(z.object({ id: z.string() }))
    const chat = vi.fn().mockResolvedValue('[{"id":"a"},{"oops":1},{"id":"c"}]')
    const onDrop = vi.fn()
    const client = { chat }
    const out = await callWithSchema({
      client,
      promptId: 'arr',
      schema,
      onDrop,
    })
    expect(out).toEqual([{ id: 'a' }, { id: 'c' }])
    expect(onDrop).toHaveBeenCalledTimes(1)
    expect(onDrop).toHaveBeenCalledWith({ key: '1', reason: expect.any(String) })
  })

  it('throws LlmStructuredError (not Error) when schema fails with no array recovery', async () => {
    const chat = vi.fn().mockResolvedValue('{"b":1}')
    const client = { chat }
    await expect(callWithSchema({ ...baseOpts, client, maxRetries: 0 })).rejects.toSatisfy(
      (e) => e instanceof LlmStructuredError,
    )
    expect(chat).toHaveBeenCalledTimes(1)
  })

  it('retries once when JSON parses but schema fails, then succeeds', async () => {
    const chat = vi.fn().mockResolvedValueOnce('{"b":1}').mockResolvedValueOnce('{"a":3}')
    const client = { chat }
    const out = await callWithSchema({ ...baseOpts, client, maxRetries: 1 })
    expect(out).toEqual({ a: 3 })
    expect(chat).toHaveBeenCalledTimes(2)
  })
})
