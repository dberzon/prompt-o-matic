function cosineDistance(a, b) {
  let dot = 0
  let normA = 0
  let normB = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (!normA || !normB) return 1
  const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB))
  return 1 - similarity
}

export function createMockVectorStore() {
  const byId = new Map()

  return {
    async upsert({ id, embedding, document, metadata = {} }) {
      byId.set(id, { id, embedding, document, metadata })
    },

    async queryByEmbedding({ embedding, limit = 5 }) {
      return Array.from(byId.values())
        .map((item) => {
          const distance = cosineDistance(embedding, item.embedding)
          return {
            id: item.id,
            distance,
            score: 1 / (1 + distance),
            metadata: item.metadata,
            document: item.document,
            raw: item,
          }
        })
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
        .slice(0, limit)
    },

    async checkAvailability() {
      return { available: true, count: byId.size }
    },
  }
}
