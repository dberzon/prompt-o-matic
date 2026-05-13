/**
 * @typedef {import('./tool.js').ToolDescriptor} ToolDescriptor
 */

/**
 * @param {string} message
 * @param {{ issues: import('zod').ZodIssue[]; toolName: string }} ctx
 */
export class ToolInputValidationError extends Error {
  constructor(message, ctx) {
    super(message)
    this.name = 'ToolInputValidationError'
    this.issues = ctx.issues
    this.toolName = ctx.toolName
  }
}

/**
 * @param {string} message
 * @param {{ issues: import('zod').ZodIssue[]; toolName: string }} ctx
 */
export class ToolOutputValidationError extends Error {
  constructor(message, ctx) {
    super(message)
    this.name = 'ToolOutputValidationError'
    this.issues = ctx.issues
    this.toolName = ctx.toolName
  }
}

export class ToolNotFoundError extends Error {
  /**
   * @param {string} name
   */
  constructor(name) {
    super(`Unknown tool: ${name}`)
    this.name = 'ToolNotFoundError'
    this.toolName = name
  }
}

/**
 * @param {{ tools: ToolDescriptor[] }} opts
 */
export function createRegistry({ tools }) {
  const byName = new Map()
  for (const t of tools) {
    if (byName.has(t.name)) {
      throw new Error(`Duplicate tool name in registry: ${t.name}`)
    }
    byName.set(t.name, t)
  }

  return {
    /**
     * @param {string} name
     * @returns {ToolDescriptor | undefined}
     */
    getTool(name) {
      return byName.get(name)
    },
    listTools() {
      return [...tools]
    },
    /**
     * @param {string} name
     * @param {unknown} input
     */
    async invoke(name, input) {
      const t = byName.get(name)
      if (!t) throw new ToolNotFoundError(name)

      const parsedIn = t.input.safeParse(input)
      if (!parsedIn.success) {
        throw new ToolInputValidationError(`Invalid input for tool "${name}"`, {
          issues: parsedIn.error.issues,
          toolName: name,
        })
      }

      const raw = await t.handler(parsedIn.data)
      const parsedOut = t.output.safeParse(raw)
      if (!parsedOut.success) {
        throw new ToolOutputValidationError(`Invalid output from tool "${name}"`, {
          issues: parsedOut.error.issues,
          toolName: name,
        })
      }
      return parsedOut.data
    },
  }
}
