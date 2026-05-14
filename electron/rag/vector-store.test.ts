import * as assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { JsonVectorStore } from './vector-store.ts'

test('persists chunks and returns the most similar matches first', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-box-rag-'))
  try {
    const store = new JsonVectorStore(join(dir, 'vectors.json'))
    await store.addChunks([
      {
        id: 'a',
        sourceId: 'doc-a',
        sourceName: 'alpha.md',
        chunkIndex: 0,
        content: 'alpha content',
        embedding: [1, 0, 0],
        createdAt: 1,
      },
      {
        id: 'b',
        sourceId: 'doc-b',
        sourceName: 'beta.md',
        chunkIndex: 0,
        content: 'beta content',
        embedding: [0, 1, 0],
        createdAt: 1,
      },
    ])

    const reloaded = new JsonVectorStore(join(dir, 'vectors.json'))
    const results = await reloaded.search([0.95, 0.05, 0], {
      limit: 2,
      queryText: 'alpha content',
    })

    assert.equal(results.length, 2)
    assert.equal(results[0].chunk.id, 'a')
    assert.equal(results[0].chunk.sourceName, 'alpha.md')
    assert.ok(results[0].score > results[1].score)
    assert.equal(results[0].scoreBreakdown.vectorScore > 0, true)
    assert.equal(typeof results[0].scoreBreakdown.keywordScore, 'number')
    assert.equal(typeof results[0].scoreBreakdown.combinedScore, 'number')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('keyword matches can outrank weaker vector-only matches', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-box-rag-'))
  try {
    const store = new JsonVectorStore(join(dir, 'vectors.json'))
    await store.addChunks([
      {
        id: 'vector-only',
        sourceId: 'doc-a',
        sourceName: 'notes.md',
        chunkIndex: 0,
        content: 'general troubleshooting notes',
        embedding: [0.99, 0.01],
        createdAt: 1,
      },
      {
        id: 'deploy-keywords',
        sourceId: 'doc-b',
        sourceName: 'deploy.md',
        chunkIndex: 0,
        content: '部署 token 默认值 位于 settings.tokenDefault',
        embedding: [0.72, 0.62],
        createdAt: 1,
      },
    ])

    const results = await store.search([1, 0], {
      limit: 1,
      queryText: '部署 token 默认值',
    })

    assert.equal(results[0].chunk.id, 'deploy-keywords')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('search limits repeated chunks from the same source when alternatives exist', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-box-rag-'))
  try {
    const store = new JsonVectorStore(join(dir, 'vectors.json'))
    await store.addChunks([
      {
        id: 'doc-a-0',
        sourceId: 'doc-a',
        sourceName: 'deploy.md',
        chunkIndex: 0,
        content: '部署 token 默认值 说明',
        embedding: [0.99, 0.01],
        createdAt: 1,
      },
      {
        id: 'doc-a-1',
        sourceId: 'doc-a',
        sourceName: 'deploy.md',
        chunkIndex: 1,
        content: '部署 token 使用限制',
        embedding: [0.97, 0.03],
        createdAt: 1,
      },
      {
        id: 'doc-b-0',
        sourceId: 'doc-b',
        sourceName: 'settings.md',
        chunkIndex: 0,
        content: 'settings.tokenDefault 控制默认值',
        embedding: [0.9, 0.1],
        createdAt: 1,
      },
    ])

    const results = await store.search([1, 0], {
      limit: 2,
      queryText: '部署 token 默认值',
      diversifyBySource: true,
    })

    assert.equal(results.length, 2)
    assert.notEqual(results[0].chunk.sourceId, results[1].chunk.sourceId)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('removes existing chunks for a source before re-indexing it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-box-rag-'))
  try {
    const store = new JsonVectorStore(join(dir, 'vectors.json'))
    await store.addChunks([
      {
        id: 'old',
        sourceId: 'doc-a',
        sourceName: 'old.md',
        chunkIndex: 0,
        content: 'old content',
        embedding: [1, 0],
        createdAt: 1,
      },
    ])

    await store.replaceSourceChunks('doc-a', [
      {
        id: 'new',
        sourceId: 'doc-a',
        sourceName: 'new.md',
        chunkIndex: 0,
        content: 'new content',
        embedding: [0, 1],
        createdAt: 2,
      },
    ])

    const all = await store.listChunks()
    assert.deepEqual(
      all.map((chunk) => chunk.id),
      ['new']
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('removes one source and can clear the remaining knowledge base', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-box-rag-'))
  try {
    const store = new JsonVectorStore(join(dir, 'vectors.json'))
    await store.addChunks([
      {
        id: 'a-0',
        sourceId: 'doc-a',
        sourceName: 'alpha.md',
        chunkIndex: 0,
        content: 'alpha',
        embedding: [1, 0],
        createdAt: 1,
      },
      {
        id: 'b-0',
        sourceId: 'doc-b',
        sourceName: 'beta.md',
        chunkIndex: 0,
        content: 'beta',
        embedding: [0, 1],
        createdAt: 2,
      },
    ])

    await store.removeSource('doc-a')
    assert.deepEqual(
      (await store.listSources()).map((source) => source.id),
      ['doc-b']
    )

    await store.clear()
    assert.deepEqual(await store.listSources(), [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
