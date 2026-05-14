import type { APICompatibility, ChatOptions, Message, ProviderConfig, LLMProvider } from './types'
import { BaseProvider } from './base'

export class CustomProvider extends BaseProvider {
  name = 'Custom'
  private apiType: APICompatibility

  constructor(baseURL: string, apiType: APICompatibility, apiKey?: string, model?: string) {
    super(apiKey, baseURL, model)
    this.apiType = apiType
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    if (this.apiType === 'anthropic') {
      return this.chatAnthropic(messages, options)
    }

    return this.chatOpenAICompatible(messages, options)
  }

  private async chatOpenAICompatible(messages: Message[], options?: ChatOptions): Promise<string> {
    const baseURL = this.baseURL
    if (!baseURL) throw new Error('Custom provider requires baseURL')
    const onChunk = options?.onChunk

    const requestBody: Record<string, unknown> = {
      model: this.model || 'default',
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: !!onChunk,
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    if (onChunk) {
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: options?.signal,
      })

      if (!response.ok) {
        throw new Error(`Custom API error: ${response.status}`)
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
                  const content = parsed.choices?.[0]?.delta?.content || ''
                  if (content) {
                    fullContent += content
                    onChunk({ content, done: false })
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
        throw new Error(`Custom API error: ${response.status}`)
      }

      const data = await response.json()
      return data.choices?.[0]?.message?.content || ''
    }
  }

  getDefaultModel(): string {
    return this.model || 'custom-model'
  }

  private async chatAnthropic(messages: Message[], options?: ChatOptions): Promise<string> {
    const baseURL = this.baseURL
    if (!baseURL) throw new Error('Custom provider requires baseURL')

    const model = this.model || this.getDefaultModel()
    const onChunk = options?.onChunk
    const systemMessage = messages.find((message) => message.role === 'system')
    const conversationMessages = messages.filter((message) => message.role !== 'system')
    const requestBody: Record<string, unknown> = {
      model,
      messages: conversationMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      max_tokens: 4096,
    }

    if (systemMessage) {
      requestBody.system = systemMessage.content
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    }

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey
    }

    if (onChunk) {
      const response = await fetch(`${this.resolveAnthropicBaseURL(baseURL)}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...requestBody, stream: true }),
        signal: options?.signal,
      })

      if (!response.ok) {
        throw new Error(`Custom Anthropic-compatible API error: ${response.status}`)
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
                  if (parsed.type === 'content_block_delta') {
                    const content = parsed.delta?.text || ''
                    if (content) {
                      fullContent += content
                      onChunk({ content, done: false })
                    }
                  }
                } catch {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }
          }
        }
      }

      return fullContent
    }

    const response = await fetch(`${this.resolveAnthropicBaseURL(baseURL)}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: options?.signal,
    })

    if (!response.ok) {
      throw new Error(`Custom Anthropic-compatible API error: ${response.status}`)
    }

    const data = await response.json()
    return data.content?.[0]?.text || ''
  }

  private resolveAnthropicBaseURL(baseURL: string): string {
    return baseURL.endsWith('/v1') ? baseURL : `${baseURL}/v1`
  }
}

export const customDefinition = {
  id: 'custom',
  name: '自定义',
  getDefaultConfig(): ProviderConfig {
    return {
      id: 'custom',
      name: '自定义',
      baseURL: '',
      apiKey: '',
      model: '',
      apiType: 'openai',
      enabled: false,
    }
  },
  validateConfig(config: ProviderConfig): string | null {
    if (!config.enabled) {
      return '自定义 Provider 当前已禁用，请先在设置中启用后再试。'
    }
    const url = typeof config.baseURL === 'string' ? config.baseURL : ''
    return url.trim() ? null : '自定义 Provider 尚未配置基地址，请先在设置中补充后再试。'
  },
  createProvider(config: ProviderConfig): LLMProvider | null {
    const url = typeof config.baseURL === 'string' ? config.baseURL : ''
    const key = typeof config.apiKey === 'string' ? config.apiKey : ''
    return new CustomProvider(url.trim(), config.apiType, key.trim(), config.model)
  },
}
