type FetchLike = typeof fetch

export interface LMStudioEmbeddingsClientOptions {
  baseURL: string
  model: string
  apiKey?: string
  fetchImpl?: FetchLike
}

interface EmbeddingsResponse {
  data?: Array<{ embedding?: number[] }>
}

export class LMStudioEmbeddingsClient {
  private readonly baseURL: string
  private readonly model: string
  private readonly apiKey: string
  private readonly fetchImpl: FetchLike

  constructor(options: LMStudioEmbeddingsClientOptions) {
    this.baseURL = normalizeBaseURL(options.baseURL)
    this.model = options.model.trim()
    this.apiKey = options.apiKey ?? ''
    this.fetchImpl = options.fetchImpl ?? fetch

    if (!this.model) {
      throw new Error('请选择 LMStudio 嵌入模型')
    }
  }

  async embed(input: string[]): Promise<number[][]> {
    if (input.length === 0) {
      return []
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`
    }

    const response = await this.fetchImpl(`${this.baseURL}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        input,
      }),
    })

    if (!response.ok) {
      throw new Error(`LMStudio embeddings API error: ${response.status}`)
    }

    const payload = (await response.json()) as EmbeddingsResponse
    const embeddings = payload.data?.map((item) => item.embedding).filter(isEmbedding) ?? []
    if (embeddings.length !== input.length) {
      throw new Error('LMStudio embeddings response did not match the input count')
    }

    return embeddings
  }
}

function normalizeBaseURL(baseURL: string): string {
  const trimmed = baseURL.trim().replace(/\/+$/g, '')
  if (!trimmed) {
    return 'http://127.0.0.1:1234/v1'
  }
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`
}

function isEmbedding(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number')
}
