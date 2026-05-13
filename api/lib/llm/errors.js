/**
 * Thrown when structured LLM output cannot be parsed as JSON or validated with Zod
 * after the configured repair attempts.
 */
export class LlmStructuredError extends Error {
  /**
   * @param {string} message
   * @param {{ issues: import('zod').ZodIssue[]; rawText: string }} ctx
   */
  constructor(message, { issues, rawText }) {
    super(message)
    this.name = 'LlmStructuredError'
    /** @type {import('zod').ZodIssue[]} */
    this.issues = issues
    /** @type {string} */
    this.rawText = rawText
  }
}
