function isTrue(value) {
  return String(value || '').toLowerCase() === 'true'
}

function makeError(message, code) {
  const err = new Error(message)
  err.status = 403
  err.code = code
  return err
}

export function assertComfyApiEnabled(env = process.env) {
  const mode = String(env.APP_MODE || 'local-studio')
  if (!isTrue(env.ENABLE_COMFY_API) && mode === 'cloud') {
    throw makeError('Comfy API is disabled. Set ENABLE_COMFY_API=true to enable.', 'COMFY_API_DISABLED')
  }
}

export function assertComfyOperationAllowed(operation, env = process.env) {
  assertComfyApiEnabled(env)
  const mode = String(env.APP_MODE || 'local-studio')
  if (mode === 'cloud' && operation !== 'status') {
    throw makeError(
      `Comfy operation "${operation}" is blocked in APP_MODE=cloud.`,
      'COMFY_API_BLOCKED_IN_CLOUD',
    )
  }
}
