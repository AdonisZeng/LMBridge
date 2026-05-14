import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  braveWebSearch,
  searxngWebSearch,
  tavilyWebSearch,
} from './adapters.ts'
import type { WebSearchConfig } from './types.ts'

const baseConfig: WebSearchConfig = {
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

test('brave adapter sends token header and normalizes web results', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify({
      web: {
        results: [
          {
            title: 'Brave Result',
            url: 'https://example.com/brave',
            description: 'Brave snippet',
            age: 'May 12, 2026',
          },
        ],
      },
    }), { status: 200 })
  }

  const results = await braveWebSearch({
    config: baseConfig,
    query: 'ai box',
    fetchImpl,
    signal: AbortSignal.timeout(1000),
  })

  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /q=ai\+box/)
  assert.equal((calls[0].init?.headers as Record<string, string>)['X-Subscription-Token'], 'secret')
  assert.deepEqual(results, [
    {
      id: 'brave-1',
      title: 'Brave Result',
      url: 'https://example.com/brave',
      snippet: 'Brave snippet',
      publishedAt: 'May 12, 2026',
      provider: 'brave',
      rank: 1,
    },
  ])
})

test('tavily adapter sends json payload and normalizes results', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify({
      results: [
        {
          title: 'Tavily Result',
          url: 'https://example.com/tavily',
          content: 'Tavily snippet',
          published_date: '2026-05-12',
        },
      ],
    }), { status: 200 })
  }

  const results = await tavilyWebSearch({
    config: { ...baseConfig, provider: 'tavily', baseURL: 'https://api.tavily.com/search' },
    query: 'ai box',
    fetchImpl,
    signal: AbortSignal.timeout(1000),
  })

  assert.equal(calls[0].url, 'https://api.tavily.com/search')
  assert.equal(calls[0].init?.method, 'POST')
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    api_key: 'secret',
    query: 'ai box',
    max_results: 5,
    search_depth: 'basic',
    include_answer: false,
    include_raw_content: false,
  })
  assert.deepEqual(results[0], {
    id: 'tavily-1',
    title: 'Tavily Result',
    url: 'https://example.com/tavily',
    snippet: 'Tavily snippet',
    publishedAt: '2026-05-12',
    provider: 'tavily',
    rank: 1,
  })
})

test('searxng adapter sends json query and normalizes results', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify({
      results: [
        {
          title: 'SearXNG Result',
          url: 'https://example.com/searxng',
          content: 'SearXNG snippet',
          publishedDate: '2026-05-12',
        },
      ],
    }), { status: 200 })
  }

  const results = await searxngWebSearch({
    config: { ...baseConfig, provider: 'searxng', baseURL: 'https://search.example.com' },
    query: 'ai box',
    fetchImpl,
    signal: AbortSignal.timeout(1000),
  })

  assert.match(calls[0].url, /^https:\/\/search\.example\.com\/search\?/)
  assert.match(calls[0].url, /format=json/)
  assert.match(calls[0].url, /categories=general/)
  assert.deepEqual(results[0], {
    id: 'searxng-1',
    title: 'SearXNG Result',
    url: 'https://example.com/searxng',
    snippet: 'SearXNG snippet',
    publishedAt: '2026-05-12',
    provider: 'searxng',
    rank: 1,
  })
})
