/**
 * @typedef {import('zod').ZodTypeAny} ZodTypeAny
 */

/**
 * @typedef {{
 *   name: string
 *   description: string
 *   input: ZodTypeAny
 *   output: ZodTypeAny
 *   handler: (input: unknown) => unknown | Promise<unknown>
 * }} ToolDescriptor
 */

/**
 * @param {{
 *   name: string
 *   description: string
 *   input: ZodTypeAny
 *   output: ZodTypeAny
 *   handler: (input: unknown) => unknown | Promise<unknown>
 * }} opts
 * @returns {ToolDescriptor}
 */
export function tool(opts) {
  const { name, description, input, output, handler } = opts
  if (!name || typeof name !== 'string') throw new TypeError('tool: name must be a non-empty string')
  if (!description || typeof description !== 'string') throw new TypeError('tool: description must be a non-empty string')
  if (!input || typeof input.safeParse !== 'function') throw new TypeError('tool: input must be a Zod schema')
  if (!output || typeof output.safeParse !== 'function') throw new TypeError('tool: output must be a Zod schema')
  if (typeof handler !== 'function') throw new TypeError('tool: handler must be a function')
  return Object.freeze({ name, description, input, output, handler })
}
