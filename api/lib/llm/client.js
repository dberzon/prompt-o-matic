import { getPrompt } from '../prompts/registry.js'
import { renderPrompt } from '../prompts/render.js'
import { resolveProviderSelection, runWithResolvedProvider } from '../polishCore.js'

/**
 * @typedef {{ record?: (evt: Record<string, unknown>) => void }} Telemetry
 */

/**
 * @param {{
 *   env?: NodeJS.ProcessEnv
 *   fetchImpl?: typeof fetch
 *   telemetry?: Telemetry
 *   resolveSelection?: typeof resolveProviderSelection
 * }} [opts]
 */
export function createLlmClient({
  env = process.env,
  fetchImpl = fetch,
  telemetry = { record: () => {} },
  resolveSelection = resolveProviderSelection,
} = {}) {
  /**
   * @param {{ system?: string; user: string; providerPayload?: Record<string, unknown> }} input
   */
  async function raw({ system = '', user, providerPayload = {} }) {
    telemetry.record?.({ kind: 'llm.raw', userLen: user.length, systemLen: system.length })
    const providerSelection = await resolveSelection({
      engine: /** @type {'auto'|'local'|'cloud'|'embedded'} */ (providerPayload.engine || 'auto'),
      localOnly: false,
      fetchImpl,
      env,
      payload: providerPayload,
    })
    return runWithResolvedProvider({
      provider: providerSelection.provider,
      userMessage: user,
      payload: providerPayload,
      fetchImpl,
      env,
      systemPrompt: system,
    })
  }

  /**
   * @param {{
   *   promptId: string
   *   version?: string
   *   variables?: Record<string, unknown>
   *   schema?: import('zod').ZodTypeAny
   *   providerPayload?: Record<string, unknown>
   * }} opts
   */
  async function chat(opts) {
    const { promptId, version, variables = {}, providerPayload = {} } = opts
    void opts.schema
    telemetry.record?.({ kind: 'llm.chat', promptId, version })
    const rec = getPrompt(promptId, version)
    const user = renderPrompt(rec.body, variables)
    return raw({
      system: 'Return strict JSON only.',
      user,
      providerPayload,
    })
  }

  return { raw, chat }
}
