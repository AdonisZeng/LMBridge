import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bot,
  Database,
  FilePlus2,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Send,
  User,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn, useRefreshSettings } from '@/lib/utils'
import { useSettingsStore } from '@/lib/store'
import { getProviderValidationError, type Message, type ProviderConfig } from '@/lib/providers'
import type { RagSearchResult, RagSourceSummary } from '@/types/rag'

const GREETING_MESSAGE = '选择文件构建知识库后，我可以基于检索到的内容回答问题。'

interface RagChatMessage extends Message {
  sources?: RagSearchResult[]
}

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath
}

function getUniqueSourceNames(matches?: RagSearchResult[]): string[] {
  if (!matches) return []
  return [...new Set(matches.map((match) => match.chunk.sourceName))]
}

export function RagWorkspace() {
  useRefreshSettings()
  const { providers, decryptApiKeys, getDecryptedApiKey } = useSettingsStore()
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [sources, setSources] = useState<RagSourceSummary[]>([])
  const [messages, setMessages] = useState<RagChatMessage[]>([
    {
      id: 'rag-greeting',
      role: 'assistant',
      content: GREETING_MESSAGE,
      timestamp: Date.now(),
    },
  ])
  const [question, setQuestion] = useState('')
  const [isIndexing, setIsIndexing] = useState(false)
  const [isAnswering, setIsAnswering] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string>('')

  const lmstudioConfig = useMemo(
    () => providers.find((provider) => provider.id === 'lmstudio'),
    [providers]
  )

  const refreshSources = useCallback(async () => {
    try {
      setSources(await window.electronAPI.rag.listSources())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '读取知识库失败')
    }
  }, [])

  useEffect(() => {
    refreshSources()
  }, [refreshSources])

  const resolveRunnableLMStudioConfig = async (): Promise<ProviderConfig & { embeddingModel: string } | null> => {
    await decryptApiKeys()
    const latestSettings = useSettingsStore.getState()
    const config = latestSettings.providers.find((provider) => provider.id === 'lmstudio')

    if (!config) {
      setError('未找到 LMStudio 配置，请先在设置中添加或恢复默认 Provider。')
      return null
    }

    const resolvedEmbeddingModel = config.embeddingModel || 'nomic-embed-text-v1.5'

    const runnableConfig: ProviderConfig & { embeddingModel: string } = {
      ...config,
      apiKey:
        latestSettings.getDecryptedApiKey('lmstudio') ||
        getDecryptedApiKey('lmstudio') ||
        (typeof config.apiKey === 'string' ? config.apiKey : ''),
      embeddingModel: resolvedEmbeddingModel,
    }

    const validationError = getProviderValidationError(runnableConfig)
    if (validationError) {
      setError(validationError)
      return null
    }

    if (!resolvedEmbeddingModel.trim()) {
      setError('请先在LMStudio设置中配置嵌入模型。')
      return null
    }

    return runnableConfig
  }

  const handleSelectFiles = async () => {
    setError('')
    const filePaths = await window.electronAPI.rag.selectFiles()
    if (filePaths.length > 0) {
      setSelectedFiles(filePaths)
      setStatus(`已选择 ${filePaths.length} 个文件`)
    }
  }

  const handleIndexFiles = async () => {
    if (selectedFiles.length === 0 || isIndexing) return

    const providerConfig = await resolveRunnableLMStudioConfig()
    if (!providerConfig) return

    setIsIndexing(true)
    setError('')
    setStatus('正在向 LMStudio 请求嵌入并写入本地知识库...')

    try {
      const result = await window.electronAPI.rag.indexFiles({
        filePaths: selectedFiles,
        providerConfig,
        embeddingModel: providerConfig.embeddingModel,
      })
      setSources(result.sources)
      setStatus(`索引完成：新增/更新 ${result.indexedChunks} 个文本块`)
      setSelectedFiles([])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '索引失败')
    } finally {
      setIsIndexing(false)
    }
  }

  const handleAsk = async () => {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || isAnswering) return

    const providerConfig = await resolveRunnableLMStudioConfig()
    if (!providerConfig) return

    const userMessage: RagChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: trimmedQuestion,
      timestamp: Date.now(),
    }
    const assistantMessageId = createMessageId()
    const assistantPlaceholder: RagChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    const conversationMessages = [...messages, userMessage].filter(
      (message) => message.id !== 'rag-greeting'
    )

    setMessages((current) => [...current, userMessage, assistantPlaceholder])
    setQuestion('')
    setIsAnswering(true)
    setError('')
    setStatus('正在检索知识库并生成回答...')

    try {
      const result = await window.electronAPI.rag.query({
        providerConfig,
        embeddingModel: providerConfig.embeddingModel,
        messages: conversationMessages,
        question: trimmedQuestion,
        limit: 5,
      })

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? { ...message, content: result.answer, sources: result.matches }
            : message
        )
      )
      setStatus(result.matches.length > 0 ? `已引用 ${result.matches.length} 个知识片段` : '未检索到相关知识片段')
    } catch (caught) {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                content: `错误: ${caught instanceof Error ? caught.message : '问答失败'}`,
              }
            : message
        )
      )
      setError(caught instanceof Error ? caught.message : '问答失败')
    } finally {
      setIsAnswering(false)
    }
  }

  const handleQuestionKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleAsk()
    }
  }

  const totalChunks = sources.reduce((sum, source) => sum + source.chunkCount, 0)

  return (
    <div className="h-full bg-slate-50 text-slate-900 transition-colors dark:bg-[#0F172A] dark:text-slate-50">
      <div className="flex h-full min-h-0">
        <aside className="flex w-[320px] shrink-0 flex-col border-r border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-black/25">
          <div className="border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Database className="h-4 w-4 text-[#4a9eff]" />
              <span>本地知识库</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-50">{sources.length}</div>
                <div>文件</div>
              </div>
              <div className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-50">{totalChunks}</div>
                <div>文本块</div>
              </div>
            </div>
          </div>

          <div className="space-y-3 border-b border-slate-200 p-4 dark:border-slate-800">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              嵌入模型配置
            </label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-black/40">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {lmstudioConfig?.embeddingModel || 'nomic-embed-text-v1.5'}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                  lmstudioConfig?.enabled !== false 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    lmstudioConfig?.enabled !== false ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  {lmstudioConfig?.enabled !== false ? '已连接' : '未连接'}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                配置来源：LMStudio 设置
              </p>
            </div>
          </div>

          <div className="space-y-3 border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="flex gap-2">
              <button
                onClick={handleSelectFiles}
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-black dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <FilePlus2 className="h-4 w-4" />
                选择文件
              </button>
              <button
                onClick={handleIndexFiles}
                disabled={selectedFiles.length === 0 || isIndexing}
                className={cn(
                  'inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-white transition',
                  selectedFiles.length === 0 || isIndexing
                    ? 'cursor-not-allowed bg-slate-300 dark:bg-slate-700'
                    : 'bg-[#2563eb] hover:bg-[#1d4ed8]'
                )}
              >
                {isIndexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                索引
              </button>
            </div>

            {selectedFiles.length > 0 && (
              <div className="max-h-32 space-y-1 overflow-y-auto text-xs text-slate-600 dark:text-slate-300">
                {selectedFiles.map((filePath) => (
                  <div key={filePath} className="truncate rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-900">
                    {getFileName(filePath)}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">知识源</span>
              <button
                onClick={refreshSources}
                className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                title="刷新"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              {sources.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  暂无知识源
                </div>
              ) : (
                sources.map((source) => (
                  <div
                    key={source.id}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-black/40"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-[#22C55E]" />
                      <span className="truncate font-medium">{source.name}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {source.chunkCount} 个文本块
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-white/70 px-5 text-xs text-slate-500 dark:border-slate-800 dark:bg-black/20 dark:text-slate-400">
            <span>{status || '上传文件后即可检索知识库回答问题'}</span>
            {error && <span className="max-w-[45%] truncate text-red-500">{error}</span>}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="mx-auto max-w-4xl space-y-5">
              {messages.map((message) => {
                const isUser = message.role === 'user'
                const sourceNames = getUniqueSourceNames(message.sources)

                return (
                  <div key={message.id} className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
                    {!isUser && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#2563eb] text-white">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div className={cn('max-w-[78%]', isUser ? 'order-first' : '')}>
                      <div
                        className={cn(
                          'rounded-lg px-4 py-3 text-sm leading-relaxed shadow-sm',
                          isUser
                            ? 'bg-[#2563eb] text-white'
                            : 'border border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-black/40 dark:text-slate-100'
                        )}
                      >
                        {message.content ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            生成中...
                          </span>
                        )}
                      </div>
                      {sourceNames.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {sourceNames.map((name) => (
                            <span
                              key={name}
                              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-black/40 dark:text-slate-400"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {isUser && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-slate-700">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white/80 px-6 py-4 dark:border-slate-800 dark:bg-black/20">
            <div className="mx-auto flex max-w-4xl items-end gap-2">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleQuestionKeyDown}
                rows={1}
                placeholder="向知识库提问... (Shift+Enter 换行)"
                className="max-h-32 min-h-[44px] flex-1 resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#4a9eff] dark:border-slate-700 dark:bg-black"
              />
              <button
                onClick={handleAsk}
                disabled={!question.trim() || isAnswering}
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white transition',
                  !question.trim() || isAnswering
                    ? 'cursor-not-allowed bg-slate-300 dark:bg-slate-700'
                    : 'bg-[#2563eb] hover:bg-[#1d4ed8]'
                )}
                title="发送"
              >
                {isAnswering ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
