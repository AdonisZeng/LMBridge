import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildRagMessages } from './prompt.ts'
import type { Message } from '../../src/lib/providers/types.ts'

test('prepends retrieved knowledge base context to chat messages', () => {
  const messages: Message[] = [
    { id: 'u1', role: 'user', content: 'How does deployment work?', timestamp: 1 },
  ]
  const matches = [
    {
      score: 0.92,
      scoreBreakdown: {
        vectorScore: 0.82,
        keywordScore: 0.3,
        combinedScore: 0.92,
      },
      chunk: {
        id: 'c1',
        sourceId: 'doc-1',
        sourceName: 'deploy.md',
        chunkIndex: 0,
        content: 'Deployments are triggered from the release screen.',
        embedding: [1, 0],
        createdAt: 1,
      },
    },
  ]

  const result = buildRagMessages({
    messages,
    matches,
    retrievalQuery: 'deployment flow release screen',
  })

  assert.equal(result[0].role, 'system')
  assert.match(result[0].content, /优先使用以下知识库内容/)
  assert.match(result[0].content, /检索查询：deployment flow release screen/)
  assert.match(result[0].content, /\[来源 1: deploy\.md #1\]/)
  assert.equal(result[1], messages[0])
})

test('adds a no-match system message when retrieval returns no reliable context', () => {
  const messages: Message[] = [
    { id: 'u1', role: 'user', content: 'Hello', timestamp: 1 },
  ]
  const result = buildRagMessages({
    messages,
    matches: [],
    retrievalQuery: 'hello knowledge base',
  })

  assert.equal(result[0].role, 'system')
  assert.match(result[0].content, /未检索到可靠的知识库内容/)
  assert.match(result[0].content, /hello knowledge base/)
  assert.equal(result[1], messages[0])
})
