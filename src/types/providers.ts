// Provider-related types are now defined in src/lib/providers/types.ts
// and re-exported from src/lib/providers/index.ts
// Re-export here for backward compatibility
export type {
  ProviderType,
  ProviderConfig,
  CategoryModelConfig,
  ProviderCategory,
  APICompatibility,
  LLMProvider,
  Message,
  StreamChunk,
  ChatOptions,
} from '@/lib/providers'

export interface ChatSession {
  id: string
  title: string
  messages: import('@/lib/providers').Message[]
  createdAt: number
  updatedAt: number
}
