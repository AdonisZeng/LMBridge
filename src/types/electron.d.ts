import type { AgentStartTaskRequest, AgentTaskEvent, AgentTaskSession } from './agent'
import type { Message, ProviderConfig, StreamChunk } from '@/lib/providers'
import type {
  RagIndexRequest,
  RagIndexResult,
  RagQueryRequest,
  RagQueryResult,
  RagSourceSummary,
} from './rag'
import type { WebSearchQueryRequest, WebSearchQueryResult } from './web-search'

export interface ChatCompletionRequest {
  requestId: number
  providerConfig: ProviderConfig
  messages: Message[]
}

export interface ChatChunkEvent {
  requestId: number
  chunk: StreamChunk
}

export interface ElectronAPI {
  getAppVersion: () => Promise<string>
  openSettingsWindow: () => Promise<void>
  log: (level: string, message: string, ...args: unknown[]) => Promise<void>
  crypto: {
    encrypt: (plaintext: string) => Promise<string | null>
    decrypt: (encryptedBase64: string) => Promise<string | null>
    isAvailable: () => Promise<boolean>
  }
  agent: {
    startTask: (request: AgentStartTaskRequest) => Promise<AgentTaskSession>
    getTaskState: (taskId: string) => Promise<AgentTaskSession | null>
    approveAction: (taskId: string, actionId: string) => Promise<AgentTaskSession | null>
    rejectAction: (taskId: string, actionId: string) => Promise<AgentTaskSession | null>
    cancelTask: (taskId: string) => Promise<AgentTaskSession | null>
    onTaskEvent: (listener: (event: AgentTaskEvent) => void) => () => void
  }
  chat: {
    complete: (request: ChatCompletionRequest) => Promise<string>
    abort: (requestId: number) => Promise<boolean>
    onChunk: (listener: (event: ChatChunkEvent) => void) => () => void
  }
  rag: {
    selectFiles: () => Promise<string[]>
    listSources: () => Promise<RagSourceSummary[]>
    removeSource: (sourceId: string) => Promise<RagSourceSummary[]>
    clearSources: () => Promise<RagSourceSummary[]>
    indexFiles: (request: RagIndexRequest) => Promise<RagIndexResult>
    query: (request: RagQueryRequest) => Promise<RagQueryResult>
  }
  webSearch: {
    query: (request: WebSearchQueryRequest) => Promise<WebSearchQueryResult>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
