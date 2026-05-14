import type { ChatOptions, Message, ProviderConfig, LLMProvider } from './types'
import { BaseProvider } from './base'

export interface LMStudioModel {
  id: string
  name: string
}

export class LMStudioProvider extends BaseProvider {
  name = 'LMStudio'

  constructor(baseURL: string, model?: string) {
    super(undefined, baseURL, model)
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    const baseURL = this.baseURL || 'http://localhost:1234/v1'
    const model = this.model || 'local-model'
    const onChunk = options?.onChunk

    const requestBody = {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: !!onChunk,
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (onChunk) {
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: options?.signal,
      })

      if (!response.ok) {
        throw new Error(`LMStudio API error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let fullContent = ''
      let done = false

      while (!done) {
        const result = await reader.read()
        done = result.done

        if (!done && result.value) {
          const chunk = decoder.decode(result.value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                onChunk({ content: '', done: true })
              } else {
                try {
                  const parsed = JSON.parse(data)
                  const delta = parsed.choices?.[0]?.delta

                  if (!delta) continue

                  const reasoningContent = delta.reasoning_content
                  const content = delta.content || ''

                  if (reasoningContent) {
                    onChunk({ content: '', reasoning_content: reasoningContent, done: false })
                  }

                  if (content) {
                    fullContent += content
                    onChunk({ content, reasoning_content: '', done: false })
                  }
                } catch {
                  // Ignore parse errors
                }
              }
            }
          }
        }
      }

      return fullContent
    } else {
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: options?.signal,
      })

      if (!response.ok) {
        throw new Error(`LMStudio API error: ${response.status}`)
      }

      const data = await response.json()
      return data.choices?.[0]?.message?.content || ''
    }
  }

  getDefaultModel(): string {
    return 'local-model'
  }

  static async fetchModels(baseURL: string): Promise<LMStudioModel[]> {
    try {
      const url = baseURL.endsWith('/v1') ? `${baseURL}/models` : `${baseURL}/v1/models`
      const response = await fetch(url)

      if (!response.ok) {
        return []
      }

      const data = await response.json()
      // LMStudio returns { data: [{ id: "model-id", ... }] }
      if (data.data && Array.isArray(data.data)) {
        return data.data.map((model: { id: string }) => ({
          id: model.id,
          name: model.id,
        }))
      }

      return []
    } catch {
      return []
    }
  }
}

export const lmstudioDefinition = {
  id: 'lmstudio',
  name: 'LMStudio',
  getDefaultConfig(): ProviderConfig {
    return {
      id: 'lmstudio',
      name: 'LMStudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: '',
      model: '',
      embeddingModel: 'nomic-embed-text-v1.5',
      apiType: 'openai',
      enabled: true,
    }
  },
  validateConfig(config: ProviderConfig): string | null {
    if (!config.enabled) {
      return 'LMStudio 当前已禁用，请先在设置中启用后再试。'
    }
    return null
  },
  createProvider(config: ProviderConfig): LLMProvider | null {
    return new LMStudioProvider(config.baseURL || 'http://localhost:1234/v1', config.model)
  },
}
