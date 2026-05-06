function isTrue(value) {
  return String(value || '').toLowerCase() === 'true'
}

function makeError(message, code) {
  const err = new Error(message)
  err.status = 403
  err.code = code
  return err
}

export function assertCharacterBatchApiEnabled(env = process.env) {
  const mode = String(env.APP_MODE || 'local-studio')
  if (!isTrue(env.ENABLE_CHARACTER_BATCH_API) && mode === 'cloud') {
    throw makeError(
      'Character batch API is disabled. Set ENABLE_CHARACTER_BATCH_API=true to enable.',
      'CHARACTER_BATCH_API_DISABLED',
    )
  }
}

export function assertCharacterBatchOperationAllowed(operation, env = process.env) {
  assertCharacterBatchApiEnabled(env)
  const mode = String(env.APP_MODE || 'local-studio')
  const readOnlyOperations = new Set(['list-batches', 'get-batch', 'list-candidates', 'list-characters'])
  if (mode === 'cloud' && !readOnlyOperations.has(operation)) {
    throw makeError(
      `Character batch operation "${operation}" is blocked in APP_MODE=cloud.`,
      'CHARACTER_BATCH_API_BLOCKED_IN_CLOUD',
    )
  }
}
