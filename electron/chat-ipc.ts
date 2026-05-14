import type { ChatOptions, LLMProvider, Message, ProviderConfig, StreamChunk } from '../src/lib/providers/types.ts'

interface IpcMainLike {
  handle: (channel: string, handler: (...args: unknown[]) => unknown) => void
}

interface IpcEventLike {
  sender?: {
    send: (channel: string, payload: unknown) => void
  }
}

export interface ChatCompletionRequest {
  requestId: number
  providerConfig: ProviderConfig
  messages: Message[]
}

export interface ChatChunkEvent {
  requestId: number
  chunk: StreamChunk
}

export interface RegisterChatIpcOptions {
  createProvider: (config: ProviderConfig) => LLMProvider | null
}

export function registerChatIpc(ipcMainLike: IpcMainLike, options: RegisterChatIpcOptions): void {
  const abortControllers = new Map<number, AbortController>()

  ipcMainLike.handle('chat:complete', async (event: IpcEventLike, request: ChatCompletionRequest) => {
    const provider = options.createProvider(request.providerConfig)
    if (!provider) {
      throw new Error(`无法创建 Provider "${request.providerConfig.name}"，请检查配置。`)
    }

    const abortController = new AbortController()
    abortControllers.set(request.requestId, abortController)

    const chatOptions: ChatOptions = {
      signal: abortController.signal,
      onChunk: (chunk) => {
        event.sender?.send('chat:chunk', {
          requestId: request.requestId,
          chunk,
        } satisfies ChatChunkEvent)
      },
    }

    try {
      return await provider.chat(request.messages, chatOptions)
    } finally {
      abortControllers.delete(request.requestId)
    }
  })

  ipcMainLike.handle('chat:abort', (_event: IpcEventLike, requestId: number) => {
    const abortController = abortControllers.get(requestId)
    abortController?.abort()
    abortControllers.delete(requestId)
    return Boolean(abortController)
  })
}
