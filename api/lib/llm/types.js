/**
 * @typedef {'cloud'|'local'|'embedded'} EngineProvider
 */

/**
 * @typedef {'claude'|'ollama'|'lmstudio'|'mock'} NamedProvider
 */

/**
 * @typedef {Object} ProviderRequest
 * @property {string} userMessage
 * @property {typeof fetch} fetchImpl
 * @property {Record<string, any>} [env]
 * @property {string} [systemPrompt]
 * @property {Record<string, any>} [payload]
 */

export {}
