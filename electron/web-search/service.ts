import type { LLMProvider } from '../../src/lib/providers/types.ts'
import { braveWebSearch, searxngWebSearch, tavilyWebSearch } from './adapters.ts'
import { buildWebSearchMessages } from './prompt.ts'
import type {
  WebSearchAdapter,
  WebSearchConfig,
  WebSearchProviderId,
  WebSearchQueryRequest,
  WebSearchQueryResult,
  WebSearchResult,
} from './types.ts'

export interface WebSearchServiceOptions {
  createProvider: (config: WebSearchQueryRequest['providerConfig']) => LLMProvider | null
  currentDate?: () => string
  fetchImpl?: typeof fetch
  searchAdapters?: Partial<Record<WebSearchProviderId, WebSearchAdapter>>
}

const DEFAULT_MAX_RESULTS = 5
const MIN_MAX_RESULTS = 1
const MAX_MAX_RESULTS = 8
const DEFAULT_TIMEOUT_MS = 8000
const QUERY_REWRITE_HISTORY_WINDOW = 6

export class WebSearchService {
  private readonly createProvider: WebSearchServiceOptions['createProvider']
  private readonly currentDate: () => string
  private readonly fetchImpl: typeof fetch
  private readonly searchAdapters: Record<WebSearchProviderId, WebSearchAdapter>

  constructor(options: WebSearchServiceOptions) {
    this.createProvider = options.createProvider
    this.currentDate = options.currentDate ?? (() => new Date().toISOString().slice(0, 10))
    this.fetchImpl = options.fetchImpl ?? fetch
    this.searchAdapters = {
      brave: braveWebSearch,
      tavily: tavilyWebSearch,
      searxng: searxngWebSearch,
      ...options.searchAdapters,
    }
  }

  async query(request: WebSearchQueryRequest): Promise<WebSearchQueryResult> {
    const question = request.question.trim()
    if (!question) {
      throw new Error('请输入问题')
    }

    const searchConfig = normalizeConfig(request.searchConfig)
    validateConfig(searchConfig)

    const provider = this.createProvider(request.providerConfig)
    if (!provider) {
      throw new Error(`无法创建 Provider "${request.providerConfig.name}"，请检查配置。`)
    }

    const query = await this.buildSearchQuery(request.messages, question, provider)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), searchConfig.timeoutMs)

    try {
      const adapter = this.searchAdapters[searchConfig.provider]
      const rawResults = await adapter({
        config: searchConfig,
        query,
        fetchImpl: this.fetchImpl,
        signal: controller.signal,
      })
      const results = dedupeResults(rawResults).slice(0, searchConfig.maxResults)

      return {
        query,
        results,
        answerMessages: buildWebSearchMessages({
          messages: request.messages,
          query,
          currentDate: this.currentDate(),
          results,
        }),
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`联网搜索超时：${searchConfig.timeoutMs}ms`)
      }

      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  private async buildSearchQuery(
    messages: WebSearchQueryRequest['messages'],
    question: string,
    provider: LLMProvider
  ): Promise<string> {
    const history = withoutTrailingQuestion(messages, question)
      .filter((message) => message.role !== 'system')
      .slice(-QUERY_REWRITE_HISTORY_WINDOW)

    try {
      const rewritten = await provider.chat([
        {
          id: 'web-search-rewrite-system',
          role: 'system',
          timestamp: Date.now(),
          content: [
            '你负责将用户当前问题改写成适合联网搜索的独立查询。',
            '只输出搜索查询，不要解释，不要回答问题，不要添加引号或项目符号。',
            '如果用户询问今天、最新、价格、版本、新闻、政策、比赛、天气或发布时间，保留时间词和关键实体。',
            `当前日期：${this.currentDate()}`,
          ].join('\n'),
        },
        {
          id: 'web-search-rewrite-user',
          role: 'user',
          timestamp: Date.now(),
          content: [
            '对话历史：',
            formatConversation(history),
            '',
            `当前问题：${question}`,
            '',
            '请输出搜索查询。',
          ].join('\n'),
        },
      ])

      return normalizeQuery(rewritten) || question
    } catch {
      return question
    }
  }
}

function normalizeConfig(config: WebSearchConfig): WebSearchConfig {
  return {
    ...config,
    baseURL: config.baseURL.trim(),
    apiKey: config.apiKey.trim(),
    country: (config.country || 'US').trim().toUpperCase(),
    language: (config.language || 'en').trim().toLowerCase(),
    maxResults: Math.min(MAX_MAX_RESULTS, Math.max(MIN_MAX_RESULTS, config.maxResults || DEFAULT_MAX_RESULTS)),
    timeoutMs: config.timeoutMs > 0 ? config.timeoutMs : DEFAULT_TIMEOUT_MS,
  }
}

function validateConfig(config: WebSearchConfig): void {
  if (!config.enabled) {
    throw new Error('联网搜索未启用，请先在设置中启用。')
  }

  if (config.provider === 'brave' && !config.apiKey) {
    throw new Error('Brave Search API Key 不能为空。')
  }

  if (config.provider === 'tavily' && !config.apiKey) {
    throw new Error('Tavily API Key 不能为空。')
  }

  if (config.provider === 'searxng' && !config.baseURL) {
    throw new Error('SearXNG 基地址不能为空。')
  }
}

function dedupeResults(results: WebSearchResult[]): WebSearchResult[] {
  const seenUrls = new Set<string>()
  const deduped: WebSearchResult[] = []

  for (const result of results) {
    const key = normalizeResultUrl(result.url)
    if (!key || seenUrls.has(key)) {
      continue
    }

    seenUrls.add(key)
    deduped.push({ ...result, rank: deduped.length + 1 })
  }

  return deduped
}

function normalizeResultUrl(value: string): string {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return ''
    }

    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_')) {
        url.searchParams.delete(key)
      }
    }

    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

function withoutTrailingQuestion(messages: WebSearchQueryRequest['messages'], question: string) {
  if (messages.length === 0) {
    return messages
  }

  const lastMessage = messages[messages.length - 1]
  if (lastMessage.role === 'user' && lastMessage.content.trim() === question) {
    return messages.slice(0, -1)
  }

  return messages
}

function formatConversation(messages: WebSearchQueryRequest['messages']): string {
  if (messages.length === 0) {
    return '(无)'
  }

  return messages.map((message) => `${formatRole(message.role)}: ${message.content.trim()}`).join('\n')
}

function formatRole(role: WebSearchQueryRequest['messages'][number]['role']): string {
  if (role === 'assistant') {
    return '助手'
  }

  if (role === 'system') {
    return '系统'
  }

  return '用户'
}

function normalizeQuery(query: string): string {
  return query
    .replace(/^(?:联网搜索查询|搜索查询|query)\s*[:：-]\s*/i, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
