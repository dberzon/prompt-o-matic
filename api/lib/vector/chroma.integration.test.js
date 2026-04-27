import { describe, expect, it } from 'vitest'
import { createChromaVectorStore } from './chromaVectorStore.js'

const enabled = String(process.env.RUN_CHROMA_INTEGRATION_TESTS || '').toLowerCase() === 'true'
const maybeDescribe = enabled ? describe : describe.skip

maybeDescribe('chroma integration (optional)', () => {
  it('can upsert and query embeddings', async () => {
    const store = createChromaVectorStore()
    await store.upsert({
      id: 'integration_char_1',
      embedding: [0.1, 0.2, 0.3],
      document: 'integration test character',
      metadata: { characterId: 'integration_char_1' },
    })

    const results = await store.queryByEmbedding({
      embedding: [0.1, 0.2, 0.3],
      limit: 1,
    })

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('integration_char_1')
  })
})
