import { callWithSchema } from '../../../llm/structuredOutput.js'
import { getPrompt } from '../../../prompts/registry.js'
import { renderPrompt } from '../../../prompts/render.js'

/**
 * @param {import('../../types.js').StageRunContext} ctx
 * @param {{ promptId: string; schema: import('zod').ZodTypeAny; variables: Record<string, unknown> }} opts
 */
export async function runLocationStructuredStage(ctx, { promptId, schema, variables }) {
  const client = {
    /**
     * @param {{ promptId: string; variables?: Record<string, unknown>; providerPayload?: Record<string, unknown> }} chatOpts
     */
    async chat(chatOpts) {
      const vars = chatOpts.variables || {}
      const rec = getPrompt(promptId)
      const user = renderPrompt(rec.body, vars)
      const pp = chatOpts.providerPayload || {}
      return ctx.llm({
        system: 'Return strict JSON only.',
        user,
        providerPayload: {
          ...pp,
          engine: pp.engine ?? 'auto',
          responseFormat: 'json',
          model: pp.model ?? ctx.modelId,
        },
      })
    },
  }
  return callWithSchema({
    client,
    promptId,
    variables,
    schema,
    maxRetries: 1,
    providerPayload: { engine: 'auto', responseFormat: 'json', model: ctx.modelId },
  })
}
