import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LLMProvider, Message, ProviderConfig } from '../../src/lib/providers/types.ts'
import { WebSearchService } from './service.ts'
import type { WebSearchConfig } from './types.ts'

const searchConfig: WebSearchConfig = {
  enabled: true,
  provider: 'brave',
  baseURL: 'https://api.search.brave.com/res/v1/web/search',
  apiKey: 'secret',
  maxResults: 5,
  country: 'US',
  language: 'en',
  safeSearch: 'moderate',
  timeoutMs: 8000,
}

const providerConfig: ProviderConfig = {
  id: 'lmstudio',
  name: 'LMStudio',
  baseURL: 'http://127.0.0.1:1234/v1',
  apiKey: '',
  model: 'chat-model',
  apiType: 'openai',
  enabled: true,
}

test('service rewrites query, searches web, and returns answer messages', async () => {
  const providerCalls: Message[][] = []
  const provider: LLMProvider = {
    name: 'stub',
    getDefaultModel: () => 'stub-model',
    async chat(messages) {
      providerCalls.push(messages)
      return 'rewritten query'
    },
  }

  const service = new WebSearchService({
    createProvider: () => provider,
    currentDate: () => '2026-05-12',
    searchAdapters: {
      brave: async () => [
        {
          id: 'brave-1',
          title: 'Result',
          url: 'https://example.com/result',
          snippet: 'Snippet',
          provider: 'brave',
          rank: 1,
        },
      ],
      tavily: async () => [],
      searxng: async () => [],
    },
  })

  const result = await service.query({
    searchConfig,
    providerConfig,
    messages: [
      { id: 'u1', role: 'user', content: 'OpenAI 最新模型是什么？', timestamp: 1 },
    ],
    question: 'OpenAI 最新模型是什么？',
  })

  assert.equal(result.query, 'rewritten query')
  assert.equal(result.results.length, 1)
  assert.equal(result.answerMessages[0].role, 'system')
  assert.match(result.answerMessages[0].content, /rewritten query/)
  assert.match(providerCalls[0][0].content, /改写成适合联网搜索的独立查询/)
})

test('service rejects disabled config and missing brave api key', async () => {
  const service = new WebSearchService({
    createProvider: () => null,
    currentDate: () => '2026-05-12',
  })

  await assert.rejects(
    () => service.query({
      searchConfig: { ...searchConfig, enabled: false },
      providerConfig,
      messages: [],
      question: 'hello',
    }),
    /联网搜索未启用/
  )

  await assert.rejects(
    () => service.query({
      searchConfig: { ...searchConfig, apiKey: '' },
      providerConfig,
      messages: [],
      question: 'hello',
    }),
    /Brave Search API Key 不能为空/
  )
})
