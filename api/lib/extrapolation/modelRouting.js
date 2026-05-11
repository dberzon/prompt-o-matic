const DEFAULT_MODEL = 'auto'

export function resolveStageModelConfig(env = process.env) {
  let parsed = {}
  const raw = env.EXTRAPOLATION_STAGE_MODELS
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = {}
    }
  }
  const stages = {}
  for (let stageId = 1; stageId <= 6; stageId += 1) {
    stages[stageId] = parsed?.[String(stageId)] || parsed?.[stageId] || DEFAULT_MODEL
  }
  return { defaultModel: DEFAULT_MODEL, stages }
}

export function resolveStageModelId(stageId, env = process.env) {
  const config = resolveStageModelConfig(env)
  return config.stages[stageId] || config.defaultModel
}
