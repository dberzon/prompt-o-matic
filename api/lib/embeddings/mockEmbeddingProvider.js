function hashText(text) {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0)
}

function toVector(seed, dims = 8) {
  const vec = []
  let state = seed
  for (let i = 0; i < dims; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0
    vec.push((state % 10000) / 10000)
  }
  return vec
}

export function createMockEmbeddingProvider({ dims = 8 } = {}) {
  async function embedText(text) {
    return toVector(hashText(String(text)), dims)
  }

  async function embedMany(texts) {
    return Promise.all(texts.map((text) => embedText(text)))
  }

  return { embedText, embedMany }
}
