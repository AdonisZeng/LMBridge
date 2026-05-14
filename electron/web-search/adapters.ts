import type { WebSearchAdapterInput, WebSearchResult } from './types.ts'

export async function braveWebSearch(input: WebSearchAdapterInput): Promise<WebSearchResult[]> {
  const endpoint = input.config.baseURL || 'https://api.search.brave.com/res/v1/web/search'
  const url = new URL(endpoint)
  url.searchParams.set('q', input.query)
  url.searchParams.set('count', String(input.config.maxResults))
  url.searchParams.set('country', input.config.country)
  url.searchParams.set('search_lang', input.config.language)
  url.searchParams.set('safesearch', input.config.safeSearch)

  const response = await input.fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': input.config.apiKey,
    },
    signal: input.signal,
  })

  if (!response.ok) {
    throw new Error(`Brave Search 请求失败: ${response.status}`)
  }

  const data = await response.json() as {
    web?: {
      results?: Array<{
        title?: string
        url?: string
        description?: string
        age?: string
      }>
    }
  }

  return normalizeResults({
    provider: 'brave',
    rows: data.web?.results ?? [],
    getTitle: (row) => row.title,
    getUrl: (row) => row.url,
    getSnippet: (row) => row.description,
    getPublishedAt: (row) => row.age,
  })
}

export async function tavilyWebSearch(input: WebSearchAdapterInput): Promise<WebSearchResult[]> {
  const endpoint = input.config.baseURL || 'https://api.tavily.com/search'
  const response = await input.fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      api_key: input.config.apiKey,
      query: input.query,
      max_results: input.config.maxResults,
      search_depth: 'basic',
      include_answer: false,
      include_raw_content: false,
    }),
    signal: input.signal,
  })

  if (!response.ok) {
    throw new Error(`Tavily Search 请求失败: ${response.status}`)
  }

  const data = await response.json() as {
    results?: Array<{
      title?: string
      url?: string
      content?: string
      published_date?: string
    }>
  }

  return normalizeResults({
    provider: 'tavily',
    rows: data.results ?? [],
    getTitle: (row) => row.title,
    getUrl: (row) => row.url,
    getSnippet: (row) => row.content,
    getPublishedAt: (row) => row.published_date,
  })
}

export async function searxngWebSearch(input: WebSearchAdapterInput): Promise<WebSearchResult[]> {
  const endpoint = input.config.baseURL || 'http://127.0.0.1:8888'
  const url = new URL('/search', endpoint.endsWith('/') ? endpoint : `${endpoint}/`)
  url.searchParams.set('q', input.query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('language', input.config.language)
  url.searchParams.set('safesearch', mapSearxngSafeSearch(input.config.safeSearch))
  url.searchParams.set('categories', 'general')

  const response = await input.fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal: input.signal,
  })

  if (!response.ok) {
    throw new Error(`SearXNG 搜索请求失败: ${response.status}`)
  }

  const data = await response.json() as {
    results?: Array<{
      title?: string
      url?: string
      content?: string
      publishedDate?: string
    }>
  }

  return normalizeResults({
    provider: 'searxng',
    rows: data.results ?? [],
    getTitle: (row) => row.title,
    getUrl: (row) => row.url,
    getSnippet: (row) => row.content,
    getPublishedAt: (row) => row.publishedDate,
  })
}

function normalizeResults<Row>(input: {
  provider: WebSearchResult['provider']
  rows: Row[]
  getTitle: (row: Row) => string | undefined
  getUrl: (row: Row) => string | undefined
  getSnippet: (row: Row) => string | undefined
  getPublishedAt: (row: Row) => string | undefined
}): WebSearchResult[] {
  const results: WebSearchResult[] = []

  for (const row of input.rows) {
    const title = normalizeText(input.getTitle(row))
    const url = normalizeUrl(input.getUrl(row))
    const snippet = normalizeText(input.getSnippet(row))
    if (!title || !url) {
      continue
    }

    const publishedAt = normalizeText(input.getPublishedAt(row))
    results.push({
      id: `${input.provider}-${results.length + 1}`,
      title,
      url,
      snippet,
      ...(publishedAt ? { publishedAt } : {}),
      provider: input.provider,
      rank: results.length + 1,
    })
  }

  return results
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function normalizeUrl(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return ''
    }

    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

function mapSearxngSafeSearch(value: 'off' | 'moderate' | 'strict'): string {
  if (value === 'strict') {
    return '2'
  }

  if (value === 'moderate') {
    return '1'
  }

  return '0'
}
