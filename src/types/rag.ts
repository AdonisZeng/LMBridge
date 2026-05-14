import type { Message, ProviderConfig } from '@/lib/providers'

export interface RagTextChunk {
  id: string
  sourceId: string
  sourceName: string
  chunkIndex: number
  content: string
  embedding: number[]
  createdAt: number
}

export interface RagScoreBreakdown {
  vectorScore: number
  keywordScore: number
  combinedScore: number
}

export interface RagSearchResult {
  chunk: RagTextChunk
  score: number
  scoreBreakdown: RagScoreBreakdown
}

export interface RagSourceSummary {
  id: string
  name: string
  chunkCount: number
  createdAt: number
}

export interface RagIndexRequest {
  filePaths: string[]
  providerConfig: ProviderConfig
  embeddingModel: string
  chunkSize?: number
  chunkOverlap?: number
}

export interface RagIndexResult {
  sources: RagSourceSummary[]
  indexedChunks: number
}

export interface RagQueryRequest {
  providerConfig: ProviderConfig
  embeddingModel: string
  messages: Message[]
  question: string
  limit?: number
}

export interface RagQueryResult {
  answer: string
  matches: RagSearchResult[]
  retrievalQuery: string
}
