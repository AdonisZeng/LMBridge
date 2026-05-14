import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { RagSearchResult, RagSourceSummary, RagTextChunk } from './types.ts'

interface VectorStoreFile {
  version: 1
  chunks: RagTextChunk[]
}

export interface SearchOptions {
  limit?: number
  minScore?: number
  queryText?: string
  diversifyBySource?: boolean
}

export class JsonVectorStore {
  private readonly filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async listChunks(): Promise<RagTextChunk[]> {
    return this.read().chunks
  }

  async listSources(): Promise<RagSourceSummary[]> {
    const chunks = await this.listChunks()
    const sources = new Map<string, RagSourceSummary>()

    for (const chunk of chunks) {
      const existing = sources.get(chunk.sourceId)
      if (existing) {
        existing.chunkCount += 1
        existing.createdAt = Math.min(existing.createdAt, chunk.createdAt)
      } else {
        sources.set(chunk.sourceId, {
          id: chunk.sourceId,
          name: chunk.sourceName,
          chunkCount: 1,
          createdAt: chunk.createdAt,
        })
      }
    }

    return [...sources.values()].sort((left, right) => right.createdAt - left.createdAt)
  }

  async addChunks(chunks: RagTextChunk[]): Promise<void> {
    const data = this.read()
    data.chunks.push(...chunks)
    this.write(data)
  }

  async replaceSourceChunks(sourceId: string, chunks: RagTextChunk[]): Promise<void> {
    const data = this.read()
    data.chunks = data.chunks.filter((chunk) => chunk.sourceId !== sourceId)
    data.chunks.push(...chunks)
    this.write(data)
  }

  async removeSource(sourceId: string): Promise<void> {
    const data = this.read()
    data.chunks = data.chunks.filter((chunk) => chunk.sourceId !== sourceId)
    this.write(data)
  }

  async clear(): Promise<void> {
    this.write({
      version: 1,
      chunks: [],
    })
  }

  async search(queryEmbedding: number[], options: SearchOptions = {}): Promise<RagSearchResult[]> {
    const limit = options.limit ?? 5
    const minScore = options.minScore ?? -1
    const chunks = await this.listChunks()
    const queryText = options.queryText ?? ''

    const ranked = chunks
      .map((chunk) => scoreChunk(queryEmbedding, queryText, chunk))
      .filter((result) => result.score >= minScore)
      .sort(compareSearchResults)

    const selected = options.diversifyBySource ? diversifyBySource(ranked, limit) : ranked
    return selected.slice(0, limit)
  }

  private read(): VectorStoreFile {
    if (!existsSync(this.filePath)) {
      return { version: 1, chunks: [] }
    }

    const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<VectorStoreFile>
    if (parsed.version !== 1 || !Array.isArray(parsed.chunks)) {
      return { version: 1, chunks: [] }
    }

    return {
      version: 1,
      chunks: parsed.chunks.filter(isValidChunk),
    }
  }

  private write(data: VectorStoreFile): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  }
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    return 0
  }

  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0

  for (let i = 0; i < left.length; i += 1) {
    dot += left[i] * right[i]
    leftMagnitude += left[i] * left[i]
    rightMagnitude += right[i] * right[i]
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude))
}

function scoreChunk(queryEmbedding: number[], queryText: string, chunk: RagTextChunk): RagSearchResult {
  const vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding)
  const keywordScore = scoreKeywordMatch(queryText, chunk)
  const combinedScore = combineScores(vectorScore, keywordScore, queryText)

  return {
    chunk,
    score: combinedScore,
    scoreBreakdown: {
      vectorScore,
      keywordScore,
      combinedScore,
    },
  }
}

function combineScores(vectorScore: number, keywordScore: number, queryText: string): number {
  if (!queryText.trim()) {
    return vectorScore
  }

  return vectorScore * 0.72 + keywordScore * 0.28
}

function scoreKeywordMatch(queryText: string, chunk: RagTextChunk): number {
  const normalizedQuery = normalizeSearchText(queryText)
  if (!normalizedQuery) {
    return 0
  }

  const queryTokens = tokenizeSearchText(normalizedQuery)
  if (queryTokens.length === 0) {
    return 0
  }

  const haystack = normalizeSearchText(`${chunk.sourceName}\n${chunk.content}`)
  const haystackTokens = new Set(tokenizeSearchText(haystack))
  let matchedWeight = 0
  let totalWeight = 0

  for (const token of queryTokens) {
    const weight = getTokenWeight(token)
    totalWeight += weight

    if (haystackTokens.has(token) || haystack.includes(token)) {
      matchedWeight += weight
    }
  }

  if (totalWeight === 0) {
    return 0
  }

  const coverage = matchedWeight / totalWeight
  const phraseBonus = haystack.includes(normalizedQuery) ? 0.12 : 0
  return Math.min(1, coverage + phraseBonus)
}

function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\r\n/g, '\n')
    .replace(/[^\p{L}\p{N}\s._/-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeSearchText(text: string): string[] {
  const normalized = normalizeSearchText(text)
  if (!normalized) {
    return []
  }

  const tokens = new Set<string>()

  for (const token of normalized.match(/[a-z0-9_./-]+/g) ?? []) {
    if (token.length >= 2) {
      tokens.add(token)
    }
  }

  for (const segment of normalized.match(/[\p{Script=Han}]+/gu) ?? []) {
    if (segment.length <= 2) {
      tokens.add(segment)
      continue
    }

    tokens.add(segment)
    for (let index = 0; index < segment.length - 1; index += 1) {
      tokens.add(segment.slice(index, index + 2))
    }
  }

  return [...tokens]
}

function getTokenWeight(token: string): number {
  if (/^[\p{Script=Han}]+$/u.test(token)) {
    return token.length >= 2 ? 1.15 : 0.6
  }

  return token.length >= 4 ? 1 : 0.7
}

function compareSearchResults(left: RagSearchResult, right: RagSearchResult): number {
  if (right.score !== left.score) {
    return right.score - left.score
  }

  if (right.scoreBreakdown.keywordScore !== left.scoreBreakdown.keywordScore) {
    return right.scoreBreakdown.keywordScore - left.scoreBreakdown.keywordScore
  }

  return right.chunk.createdAt - left.chunk.createdAt
}

function diversifyBySource(results: RagSearchResult[], limit: number): RagSearchResult[] {
  const selected: RagSearchResult[] = []
  const selectedIds = new Set<string>()
  const seenSources = new Set<string>()

  for (const result of results) {
    if (selected.length >= limit) {
      break
    }

    if (seenSources.has(result.chunk.sourceId)) {
      continue
    }

    selected.push(result)
    selectedIds.add(result.chunk.id)
    seenSources.add(result.chunk.sourceId)
  }

  for (const result of results) {
    if (selected.length >= limit) {
      break
    }

    if (selectedIds.has(result.chunk.id)) {
      continue
    }

    selected.push(result)
    selectedIds.add(result.chunk.id)
  }

  return selected
}

function isValidChunk(value: unknown): value is RagTextChunk {
  const chunk = value as Partial<RagTextChunk>
  return (
    typeof chunk.id === 'string' &&
    typeof chunk.sourceId === 'string' &&
    typeof chunk.sourceName === 'string' &&
    typeof chunk.chunkIndex === 'number' &&
    typeof chunk.content === 'string' &&
    Array.isArray(chunk.embedding) &&
    chunk.embedding.every((item) => typeof item === 'number') &&
    typeof chunk.createdAt === 'number'
  )
}
