import * as assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { LLMProvider, Message, ProviderConfig } from '../../src/lib/providers/types.ts'
import { RagService } from './service.ts'
import type { RagSearchResult } from './types.ts'

type TestEmbeddingClient = {
  embed: (input: string[]) => Promise<number[][]>
}

type TestStore = {
  search: (
    queryEmbedding: number[],
    options: Record<string, unknown>
  ) => Promise<RagSearchResult[]>
}

type MutableRagService = RagService & {
  createEmbeddingClient: () => TestEmbeddingClient
  store: TestStore
}

const providerConfig: ProviderConfig = {
  id: 'lmstudio',
  name: 'LMStudio',
  baseURL: 'http://127.0.0.1:1234/v1',
  apiKey: '',
  model: 'chat-model',
  embeddingModel: 'embed-model',
  apiType: 'openai',
  enabled: true,
}

test('rewrites follow-up questions into a standalone retrieval query', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-box-rag-service-'))
  const providerCalls: Message[][] = []
  const embedCalls: string[] = []
  const searchCalls: Array<{ queryEmbedding: number[]; options: Record<string, unknown> }> = []

  const provider: LLMProvider = {
    name: 'stub-provider',
    async chat(messages) {
      providerCalls.push(messages)
      return providerCalls.length === 1 ? '部署 token 默认值 配置' : '根据文档，默认值来自 settings.tokenDefault。'
    },
    getDefaultModel() {
      return 'stub-model'
    },
  }

  const service = new RagService({
    dataDir: dir,
    createProvider: () => provider,
  })
  const mutableService = service as unknown as MutableRagService

  mutableService.createEmbeddingClient = () => ({
    embed: async (input: string[]) => {
      embedCalls.push(...input)
      return input.map(() => [1, 0])
    },
  })
  mutableService.store = {
    search: async (queryEmbedding: number[], options: Record<string, unknown>) => {
      searchCalls.push({ queryEmbedding, options })
      return [createMatch('deploy.md', '部署 token 默认值 位于 settings.tokenDefault', 0.81)]
    },
  }

  try {
    const result = await service.query({
      providerConfig,
      embeddingModel: 'embed-model',
      question: '那默认值呢？',
      messages: [
        { id: 'u1', role: 'user', content: '部署 token 怎么配置？', timestamp: 1 },
        { id: 'a1', role: 'assistant', content: '它在部署设置里。', timestamp: 2 },
      ],
      limit: 3,
    })

    assert.equal(result.retrievalQuery, '部署 token 默认值 配置')
    assert.equal(embedCalls[0], '部署 token 默认值 配置')
    assert.equal(searchCalls[0].options.queryText, '部署 token 默认值 配置')
    assert.match(providerCalls[0][0].content, /改写成适合知识库检索的独立查询/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('filters low-confidence retrieval matches before generating the final answer prompt', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-box-rag-service-'))
  const providerCalls: Message[][] = []

  const provider: LLMProvider = {
    name: 'stub-provider',
    async chat(messages) {
      providerCalls.push(messages)
      return providerCalls.length === 1 ? '无关问题' : '我没有在知识库里检索到可靠答案。'
    },
    getDefaultModel() {
      return 'stub-model'
    },
  }

  const service = new RagService({
    dataDir: dir,
    createProvider: () => provider,
  })
  const mutableService = service as unknown as MutableRagService

  mutableService.createEmbeddingClient = () => ({
    embed: async (_input: string[]) => [[1, 0]],
  })
  mutableService.store = {
    search: async () => [
      createMatch('noise-a.md', '无关片段 A', 0.18, 0.18, 0),
      createMatch('noise-b.md', '无关片段 B', 0.16, 0.16, 0),
    ],
  }

  try {
    const result = await service.query({
      providerConfig,
      embeddingModel: 'embed-model',
      question: '这个项目的午餐菜单是什么？',
      messages: [{ id: 'u1', role: 'user', content: '这个项目的午餐菜单是什么？', timestamp: 1 }],
      limit: 5,
    })

    assert.equal(result.matches.length, 0)
    const answerCall = providerCalls.at(-1)
    assert.ok(answerCall)
    assert.equal(answerCall[0].role, 'system')
    assert.match(answerCall[0].content, /未检索到可靠的知识库内容/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createMatch(
  sourceName: string,
  content: string,
  combinedScore: number,
  vectorScore = combinedScore,
  keywordScore = 0
): RagSearchResult {
  return {
    chunk: {
      id: `${sourceName}-0`,
      sourceId: sourceName,
      sourceName,
      chunkIndex: 0,
      content,
      embedding: [1, 0],
      createdAt: 1,
    },
    score: combinedScore,
    scoreBreakdown: {
      vectorScore,
      keywordScore,
      combinedScore,
    },
  }
}
