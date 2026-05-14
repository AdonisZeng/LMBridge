import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { registerWebSearchIpc } from './ipc.ts'
import type { WebSearchQueryRequest, WebSearchQueryResult } from './types.ts'

type IpcHandler = (...args: unknown[]) => unknown

test('registers web search query handler', () => {
  const handlers = new Map<string, IpcHandler>()

  registerWebSearchIpc(
    {
      handle(channel: string, handler: IpcHandler) {
        handlers.set(channel, handler)
      },
    },
    {
      query: async () => ({
        answerMessages: [],
        results: [],
        query: 'hello',
      }),
    }
  )

  assert.deepEqual([...handlers.keys()], ['web-search:query'])
})

test('web search IPC delegates query request to service', async () => {
  const handlers = new Map<string, IpcHandler>()
  let capturedRequest: WebSearchQueryRequest | null = null
  const expected: WebSearchQueryResult = {
    answerMessages: [],
    results: [],
    query: 'captured',
  }

  registerWebSearchIpc(
    {
      handle(channel: string, handler: IpcHandler) {
        handlers.set(channel, handler)
      },
    },
    {
      query: async (request) => {
        capturedRequest = request
        return expected
      },
    }
  )

  const request = {
    searchConfig: {
      enabled: true,
      provider: 'brave',
      baseURL: 'https://api.search.brave.com/res/v1/web/search',
      apiKey: 'secret',
      maxResults: 5,
      country: 'US',
      language: 'en',
      safeSearch: 'moderate',
      timeoutMs: 8000,
    },
    providerConfig: {
      id: 'lmstudio',
      name: 'LMStudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: '',
      model: 'chat-model',
      apiType: 'openai',
      enabled: true,
    },
    messages: [],
    question: 'hello',
  } as WebSearchQueryRequest

  const result = await handlers.get('web-search:query')?.({}, request)

  assert.equal(capturedRequest, request)
  assert.equal(result, expected)
})
