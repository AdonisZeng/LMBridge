import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildMessageSources,
  buildWebMessageSources,
  resolveChatSendMode,
} from './chat-send-mode.ts'

test('chat send mode resolves agent, web, rag, then plain chat', () => {
  assert.equal(
    resolveChatSendMode({ isAgentMode: true, isRagEnabled: true, isWebSearchEnabled: true }),
    'agent'
  )
  assert.equal(
    resolveChatSendMode({ isAgentMode: false, isRagEnabled: true, isWebSearchEnabled: true }),
    'web'
  )
  assert.equal(
    resolveChatSendMode({ isAgentMode: false, isRagEnabled: false, isWebSearchEnabled: true }),
    'web'
  )
  assert.equal(
    resolveChatSendMode({ isAgentMode: false, isRagEnabled: true, isWebSearchEnabled: false }),
    'rag'
  )
  assert.equal(
    resolveChatSendMode({ isAgentMode: false, isRagEnabled: false, isWebSearchEnabled: false }),
    'chat'
  )
})

test('rag message sources are unique by source id', () => {
  const sources = buildMessageSources([
    {
      score: 0.9,
      scoreBreakdown: {
        vectorScore: 0.9,
        keywordScore: 0,
        combinedScore: 0.9,
      },
      chunk: {
        id: 'c-1',
        sourceId: 'doc-a',
        sourceName: 'alpha.md',
        chunkIndex: 0,
        content: 'alpha',
        embedding: [],
        createdAt: 1,
      },
    },
    {
      score: 0.8,
      scoreBreakdown: {
        vectorScore: 0.8,
        keywordScore: 0,
        combinedScore: 0.8,
      },
      chunk: {
        id: 'c-2',
        sourceId: 'doc-a',
        sourceName: 'alpha.md',
        chunkIndex: 1,
        content: 'alpha-2',
        embedding: [],
        createdAt: 1,
      },
    },
  ])

  assert.deepEqual(sources, [{ id: 'doc-a', name: 'alpha.md', provider: 'rag' }])
})

test('web message sources are unique by normalized url', () => {
  const sources = buildWebMessageSources([
    {
      id: 'result-1',
      title: 'AI Box Release Notes',
      url: 'https://example.com/release?utm_source=test',
      snippet: 'Release notes snippet',
      provider: 'brave',
      rank: 1,
    },
    {
      id: 'result-2',
      title: 'Duplicate Release Notes',
      url: 'https://example.com/release',
      snippet: 'Duplicate snippet',
      provider: 'brave',
      rank: 2,
    },
    {
      id: 'result-3',
      title: 'Install Guide',
      url: 'https://example.com/install',
      snippet: 'Install snippet',
      provider: 'brave',
      rank: 3,
    },
  ])

  assert.deepEqual(sources, [
    {
      id: 'web-1',
      name: 'AI Box Release Notes',
      url: 'https://example.com/release',
      snippet: 'Release notes snippet',
      provider: 'web',
    },
    {
      id: 'web-2',
      name: 'Install Guide',
      url: 'https://example.com/install',
      snippet: 'Install snippet',
      provider: 'web',
    },
  ])
})
