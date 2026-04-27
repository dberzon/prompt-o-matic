function isTrue(value) {
  return String(value || '').toLowerCase() === 'true'
}

function accessError(message, code) {
  const err = new Error(message)
  err.status = 403
  err.code = code
  return err
}

export function assertVectorMaintenanceEnabled(env = process.env) {
  if (!isTrue(env.ENABLE_VECTOR_MAINTENANCE_API)) {
    throw accessError(
      'Vector maintenance API is disabled. Set ENABLE_VECTOR_MAINTENANCE_API=true to enable.',
      'VECTOR_MAINTENANCE_DISABLED',
    )
  }
}

export function assertVectorOperationAllowed(operation, env = process.env) {
  assertVectorMaintenanceEnabled(env)
  const mode = String(env.APP_MODE || 'local-studio')
  if (mode === 'cloud' && operation !== 'status') {
    throw accessError(
      `Vector operation "${operation}" is blocked in APP_MODE=cloud.`,
      'VECTOR_MAINTENANCE_BLOCKED_IN_CLOUD',
    )
  }
}

export function sanitizeVectorStatusForMode(status, env = process.env) {
  const mode = String(env.APP_MODE || 'local-studio')
  if (mode !== 'cloud') return status
  return {
    ...status,
    sqlite: {
      ...status.sqlite,
      dbPath: null,
    },
  }
}
