import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { LLMProvider } from '../../src/lib/providers/types.ts'
import { loadTextFile } from './file-loader.ts'
import { LMStudioEmbeddingsClient } from './lmstudio-embeddings.ts'
import { buildRagMessages } from './prompt.ts'
import { splitTextIntoChunks } from './text-splitter.ts'
import type {
  RagIndexRequest,
  RagIndexResult,
  RagQueryRequest,
  RagQueryResult,
  RagTextChunk,
} from './types.ts'
import { JsonVectorStore } from './vector-store.ts'

export interface RagServiceOptions {
  dataDir: string
  createProvider: (config: RagIndexRequest['providerConfig']) => LLMProvider | null
}

const DEFAULT_RETRIEVAL_LIMIT = 5
const MIN_RELIABLE_MATCH_SCORE = 0.28
const RETRIEVAL_CANDIDATE_LIMIT_MULTIPLIER = 4
const RETRIEVAL_HISTORY_WINDOW = 6

export class RagService {
  private readonly store: JsonVectorStore
  private readonly createProvider: RagServiceOptions['createProvider']

  constructor(options: RagServiceOptions) {
    this.store = new JsonVectorStore(join(options.dataDir, 'knowledge-base.json'))
    this.createProvider = options.createProvider
  }

  async listSources() {
    return this.store.listSources()
  }

  async removeSource(sourceId: string) {
    const normalizedSourceId = sourceId.trim()
    if (!normalizedSourceId) {
      throw new Error('sourceId 不能为空')
    }

    await this.store.removeSource(normalizedSourceId)
    return this.store.listSources()
  }

  async clearSources() {
    await this.store.clear()
    return this.store.listSources()
  }

  async indexFiles(request: RagIndexRequest): Promise<RagIndexResult> {
    if (request.filePaths.length === 0) {
      throw new Error('请选择至少一个文件')
    }

    const embeddingClient = this.createEmbeddingClient(request)
    let indexedChunks = 0

    for (const filePath of request.filePaths) {
      const file = loadTextFile(filePath)
      const drafts = splitTextIntoChunks({
        text: file.text,
        sourceId: file.id,
        sourceName: file.name,
        chunkSize: request.chunkSize,
        chunkOverlap: request.chunkOverlap,
      })
      const embeddings = await embeddingClient.embed(drafts.map((chunk) => chunk.content))
      const now = Date.now()
      const chunks: RagTextChunk[] = drafts.map((chunk, index) => ({
        ...chunk,
        id: `${file.id}-${chunk.chunkIndex}-${randomUUID()}`,
        embedding: embeddings[index],
        createdAt: now,
      }))

      await this.store.replaceSourceChunks(file.id, chunks)
      indexedChunks += chunks.length
    }

    return {
      sources: await this.store.listSources(),
      indexedChunks,
    }
  }

  async query(request: RagQueryRequest): Promise<RagQueryResult> {
    const question = request.question.trim()
    if (!question) {
      throw new Error('请输入问题')
    }

    const provider = this.createProvider(request.providerConfig)
    if (!provider) {
      throw new Error(`无法创建 Provider "${request.providerConfig.name}"，请检查配置。`)
    }

    const embeddingClient = this.createEmbeddingClient(request)
    const retrievalQuery = await this.buildRetrievalQuery(request.messages, question, provider)
    const [queryEmbedding] = await embeddingClient.embed([retrievalQuery])
    const candidateLimit = Math.max(
      request.limit ?? DEFAULT_RETRIEVAL_LIMIT,
      (request.limit ?? DEFAULT_RETRIEVAL_LIMIT) * RETRIEVAL_CANDIDATE_LIMIT_MULTIPLIER
    )
    const matches = selectReliableMatches(
      await this.store.search(queryEmbedding, {
        limit: candidateLimit,
        queryText: retrievalQuery,
        diversifyBySource: true,
      }),
      request.limit ?? DEFAULT_RETRIEVAL_LIMIT
    )

    const answer = await provider.chat(
      buildRagMessages({
        messages: request.messages,
        matches,
        retrievalQuery,
      })
    )

    return {
      answer,
      matches,
      retrievalQuery,
    }
  }

  private createEmbeddingClient(request: Pick<RagIndexRequest, 'providerConfig' | 'embeddingModel'>) {
    if (request.providerConfig.id !== 'lmstudio') {
      throw new Error('RAG 模块暂时只支持 LMStudio')
    }

    return new LMStudioEmbeddingsClient({
      baseURL: request.providerConfig.baseURL,
      apiKey: request.providerConfig.apiKey,
      model: request.embeddingModel,
    })
  }

  private async buildRetrievalQuery(
    messages: RagQueryRequest['messages'],
    question: string,
    provider: LLMProvider
  ): Promise<string> {
    const trimmedQuestion = question.trim()
    const history = withoutTrailingQuestion(messages, trimmedQuestion)
      .filter((message) => message.role !== 'system')
      .slice(-RETRIEVAL_HISTORY_WINDOW)

    if (history.length === 0) {
      return trimmedQuestion
    }

    try {
      const rewritten = await provider.chat([
        {
          id: 'rag-rewrite-system',
          role: 'system',
          timestamp: Date.now(),
          content: [
            '你负责将用户当前问题改写成适合知识库检索的独立查询。',
            '只输出改写后的查询，不要解释，不要回答问题，不要添加引号或项目符号。',
            '如果当前问题已经自包含，则直接返回原问题；如果是追问，补全缺失的主题、对象和关键词。',
          ].join('\n'),
        },
        {
          id: 'rag-rewrite-user',
          role: 'user',
          timestamp: Date.now(),
          content: [
            '对话历史：',
            formatConversation(history),
            '',
            `当前问题：${trimmedQuestion}`,
            '',
            '请输出改写后的检索查询。',
          ].join('\n'),
        },
      ])

      return normalizeRetrievalQuery(rewritten) || trimmedQuestion
    } catch {
      return trimmedQuestion
    }
  }
}

function selectReliableMatches(matches: RagQueryResult['matches'], limit: number): RagQueryResult['matches'] {
  if (matches.length === 0) {
    return []
  }

  const topScore = matches[0].scoreBreakdown.combinedScore
  const threshold = Math.max(MIN_RELIABLE_MATCH_SCORE, topScore * 0.45)

  return matches
    .filter((match) => match.scoreBreakdown.combinedScore >= threshold)
    .slice(0, limit)
}

function withoutTrailingQuestion(messages: RagQueryRequest['messages'], question: string) {
  if (messages.length === 0) {
    return messages
  }

  const lastMessage = messages[messages.length - 1]
  if (lastMessage.role === 'user' && lastMessage.content.trim() === question) {
    return messages.slice(0, -1)
  }

  return messages
}

function formatConversation(messages: RagQueryRequest['messages']): string {
  if (messages.length === 0) {
    return '(无)'
  }

  return messages
    .map((message) => `${formatRole(message.role)}: ${message.content.trim()}`)
    .join('\n')
}

function formatRole(role: RagQueryRequest['messages'][number]['role']): string {
  switch (role) {
    case 'assistant':
      return '助手'
    case 'system':
      return '系统'
    default:
      return '用户'
  }
}

function normalizeRetrievalQuery(query: string): string {
  return query
    .replace(/^(?:检索查询|query)\s*[:：-]\s*/i, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
