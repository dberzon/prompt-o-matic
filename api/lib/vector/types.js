/**
 * @typedef {Object} VectorStoreMatch
 * @property {string} id
 * @property {number} [distance]
 * @property {number} [score]
 * @property {Record<string, any>} [metadata]
 * @property {string} [document]
 * @property {any} [raw]
 */

/**
 * @typedef {Object} VectorStore
 * @property {(args: { id: string, embedding: number[], document?: string, metadata?: Record<string, any> }) => Promise<void>} upsert
 * @property {(args: { embedding: number[], limit?: number }) => Promise<VectorStoreMatch[]>} queryByEmbedding
 */

export {}
