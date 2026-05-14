import type { Message, ProviderConfig } from '../../src/lib/providers/types.ts'

export type WebSearchProviderId = 'brave' | 'tavily' | 'searxng'

export type WebSearchSafeSearch = 'off' | 'moderate' | 'strict'

export interface WebSearchConfig {
  enabled: boolean
  provider: WebSearchProviderId
  baseURL: string
  apiKey: string
  maxResults: number
  country: string
  language: string
  safeSearch: WebSearchSafeSearch
  timeoutMs: number
}

export interface WebSearchResult {
  id: string
  title: string
  url: string
  snippet: string
  publishedAt?: string
  provider: WebSearchProviderId
  rank: number
}

export interface WebSearchAdapterInput {
  config: WebSearchConfig
  query: string
  fetchImpl: typeof fetch
  signal: AbortSignal
}

export type WebSearchAdapter = (input: WebSearchAdapterInput) => Promise<WebSearchResult[]>

export interface WebSearchQueryRequest {
  searchConfig: WebSearchConfig
  providerConfig: ProviderConfig
  messages: Message[]
  question: string
}

export interface WebSearchQueryResult {
  answerMessages: Message[]
  results: WebSearchResult[]
  query: string
}
