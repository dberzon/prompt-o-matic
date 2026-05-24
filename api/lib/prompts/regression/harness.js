import { getPrompt } from '../registry.js'
import { renderPrompt } from '../render.js'

/**
 * Render a registered prompt template against fixture variables (no LLM, no network).
 *
 * @param {{ promptId: string; version?: string; variables?: Record<string, unknown> }} spec
 * @returns {string}
 */
export function renderPromptFixture({ promptId, version = '1', variables = {} }) {
  const rec = getPrompt(promptId, version)
  return renderPrompt(rec.body, variables)
}
