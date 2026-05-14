import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { LMStudioEmbeddingsClient } from './lmstudio-embeddings.ts'

test('requests embeddings from the LMStudio OpenAI-compatible endpoint', async () => {
  const calls: Array<{ url: string; body: unknown }> = []
  const client = new LMStudioEmbeddingsClient({
    baseURL: 'http://127.0.0.1:1234/v1',
    model: 'nomic-embed-text',
    fetchImpl: async (url, init) => {
      calls.push({
        url: String(url),
        body: JSON.parse(String(init?.body)),
      })
      return new Response(
        JSON.stringify({
          data: [
            { embedding: [1, 0, 0] },
            { embedding: [0, 1, 0] },
          ],
        }),
        { status: 200 }
      )
    },
  })

  const vectors = await client.embed(['first', 'second'])

  assert.deepEqual(vectors, [
    [1, 0, 0],
    [0, 1, 0],
  ])
  assert.equal(calls[0].url, 'http://127.0.0.1:1234/v1/embeddings')
  assert.deepEqual(calls[0].body, {
    model: 'nomic-embed-text',
    input: ['first', 'second'],
  })
})

test('normalizes LMStudio base URLs and reports API failures', async () => {
  const client = new LMStudioEmbeddingsClient({
    baseURL: 'http://127.0.0.1:1234',
    model: 'nomic-embed-text',
    fetchImpl: async (url) => {
      assert.equal(String(url), 'http://127.0.0.1:1234/v1/embeddings')
      return new Response('nope', { status: 500 })
    },
  })

  await assert.rejects(() => client.embed(['hello']), /LMStudio embeddings API error: 500/)
})
