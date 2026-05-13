import { createLlmClient } from '../llm/client.js'
import { createVectorRuntime } from '../vector/runtime.js'
import { discoverTools } from './discover.js'
import {
  createRegistry,
  ToolInputValidationError,
  ToolNotFoundError,
  ToolOutputValidationError,
} from './registrar.js'
import { clearDetectGapsDb, setDetectGapsDb } from './detect-gaps.tool.js'
import { clearRunStageContext, setRunStageContext } from './run-stage.tool.js'
import { clearWriteAttributesDb, setWriteAttributesDb } from './write-attributes.tool.js'

/** @type {ReturnType<typeof createRegistry> | null} */
let cachedRegistry = null

export async function getCachedToolRegistry() {
  if (!cachedRegistry) {
    const tools = await discoverTools()
    cachedRegistry = createRegistry({ tools })
  }
  return cachedRegistry
}

/**
 * @param {ReturnType<typeof createRegistry>} registry
 */
export function toolDescriptorsForApi(registry) {
  return registry.listTools().map((t) => ({
    name: t.name,
    description: t.description,
    input: t.input.toJSONSchema(),
    output: t.output.toJSONSchema(),
  }))
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string} name
 * @param {unknown} input
 */
export async function invokeRegisteredTool(env, name, input) {
  const registry = await getCachedToolRegistry()
  const runtime = createVectorRuntime({ env })
  const llm = createLlmClient({ env, fetchImpl: fetch }).raw
  try {
    setRunStageContext({ db: runtime.db, llm, env })
    setWriteAttributesDb({ db: runtime.db })
    setDetectGapsDb({ db: runtime.db })
    return await registry.invoke(name, input)
  } finally {
    clearRunStageContext()
    clearWriteAttributesDb()
    clearDetectGapsDb()
    runtime.close()
  }
}

/** Vitest / harness: reset cached registry after adding tools. */
export function clearCachedToolRegistry() {
  cachedRegistry = null
}

export { ToolInputValidationError, ToolNotFoundError, ToolOutputValidationError }
