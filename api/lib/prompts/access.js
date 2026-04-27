function isTrue(value) {
  return String(value || '').toLowerCase() === 'true'
}

function makeError(message, code) {
  const err = new Error(message)
  err.status = 403
  err.code = code
  return err
}

export function assertPromptPackApiEnabled(env = process.env) {
  if (!isTrue(env.ENABLE_PROMPT_PACK_API)) {
    throw makeError(
      'Prompt-pack API is disabled. Set ENABLE_PROMPT_PACK_API=true to enable.',
      'PROMPT_PACK_API_DISABLED',
    )
  }
}

export function assertPromptPackOperationAllowed(operation, env = process.env) {
  assertPromptPackApiEnabled(env)
  const mode = String(env.APP_MODE || 'local-studio')
  const readOnly = new Set(['list'])
  if (mode === 'cloud' && !readOnly.has(operation)) {
    throw makeError(
      `Prompt-pack operation "${operation}" is blocked in APP_MODE=cloud.`,
      'PROMPT_PACK_API_BLOCKED_IN_CLOUD',
    )
  }
}
