import { ChromaClient } from 'chromadb'

const DEFAULT_CHROMA_URL = 'http://127.0.0.1:8000'
const DEFAULT_CHARACTER_COLLECTION = 'characters'

function normalizeMatches(queryResult) {
  const ids = queryResult?.ids?.[0] || []
  const distances = queryResult?.distances?.[0] || []
  const metadatas = queryResult?.metadatas?.[0] || []
  const documents = queryResult?.documents?.[0] || []

  return ids.map((id, index) => {
    const distance = typeof distances[index] === 'number' ? distances[index] : undefined
    const score = typeof distance === 'number' ? 1 / (1 + distance) : undefined
    return {
      id,
      distance,
      score,
      metadata: metadatas[index] || undefined,
      document: documents[index] || undefined,
      raw: {
        id,
        distance: distances[index],
        metadata: metadatas[index],
        document: documents[index],
      },
    }
  })
}

export function createChromaVectorStore({ env = process.env } = {}) {
  const chromaUrl = env.CHROMA_URL || DEFAULT_CHROMA_URL
  const collectionName = env.CHROMA_COLLECTION_CHARACTERS || DEFAULT_CHARACTER_COLLECTION
  const client = new ChromaClient({ path: chromaUrl })
  let collectionPromise = null

  async function getCollection() {
    if (!collectionPromise) {
      collectionPromise = client.getOrCreateCollection({ name: collectionName })
    }
    return collectionPromise
  }

  async function upsert({ id, embedding, document, metadata = {} }) {
    const collection = await getCollection()
    await collection.upsert({
      ids: [id],
      embeddings: [embedding],
      documents: [document || ''],
      metadatas: [metadata],
    })
  }

  async function queryByEmbedding({ embedding, limit = 5 }) {
    const collection = await getCollection()
    const result = await collection.query({
      queryEmbeddings: [embedding],
      nResults: limit,
      include: ['metadatas', 'distances', 'documents'],
    })
    return normalizeMatches(result)
  }

  async function checkAvailability() {
    const collection = await getCollection()
    const count = await collection.count()
    return { available: true, count }
  }

  return {
    upsert,
    queryByEmbedding,
    checkAvailability,
    config: {
      chromaUrl,
      collectionName,
    },
  }
}
