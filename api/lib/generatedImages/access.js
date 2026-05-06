function isTrue(value) {
  return String(value || '').toLowerCase() === 'true'
}

function makeError(message, code) {
  const err = new Error(message)
  err.status = 403
  err.code = code
  return err
}

export function assertGeneratedImagesApiEnabled(env = process.env) {
  const mode = String(env.APP_MODE || 'local-studio')
  if (!isTrue(env.ENABLE_GENERATED_IMAGES_API) && mode === 'cloud') {
    throw makeError(
      'Generated images API is disabled. Set ENABLE_GENERATED_IMAGES_API=true to enable.',
      'GENERATED_IMAGES_API_DISABLED',
    )
  }
}

export function assertGeneratedImagesOperationAllowed(operation, env = process.env) {
  assertGeneratedImagesApiEnabled(env)
  const mode = String(env.APP_MODE || 'local-studio')
  const readOnlyInCloud = new Set(['list'])
  if (mode === 'cloud' && !readOnlyInCloud.has(operation)) {
    throw makeError(
      `Generated image operation "${operation}" is blocked in APP_MODE=cloud.`,
      'GENERATED_IMAGES_API_BLOCKED_IN_CLOUD',
    )
  }
}

