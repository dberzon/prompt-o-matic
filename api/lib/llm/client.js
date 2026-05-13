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
   * @param {{ promptId: string; version?: string; variables?: Record<string, unknown> }} _opts
   */
  async function chat(_opts) {
    throw new Error('createLlmClient().chat is not wired yet; use raw()')
  }

  return { raw, chat }
}
