export type APICompatibility = 'openai' | 'anthropic' | 'custom'

export type ProviderCategory = 'text'

export interface CategoryModelConfig {
  text?: string
}

export interface ProviderConfig {
  id: string
  name: string
  baseURL: string
  apiKey: string
  model: string
  apiType: APICompatibility
  enabled: boolean
  embeddingModel?: string
  categoryModels?: CategoryModelConfig
}

export interface MessageSource {
  id: string
  name: string
  url?: string
  snippet?: string
  publishedAt?: string
  provider?: 'rag' | 'web'
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  thinking?: string
  thinkingExpanded?: boolean
  timestamp: number
  origin?: 'chat' | 'rag' | 'web' | 'agent'
  tone?: 'default' | 'status' | 'success' | 'error' | 'rejected'
  sources?: MessageSource[]
}

export interface StreamChunk {
  content: string
  done: boolean
  reasoning_content?: string
}

export interface ChatOptions {
  onChunk?: (chunk: StreamChunk) => void
  signal?: AbortSignal
}

export interface LLMProvider {
  name: string
  chat(messages: Message[], options?: ChatOptions): Promise<string>
  getDefaultModel(): string
}
