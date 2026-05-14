import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Database,
  FilePlus2,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useSettingsStore } from '@/lib/store'
import { cn, useRefreshSettings } from '@/lib/utils'
import { getProviderValidationError, type ProviderConfig } from '@/lib/providers'
import type { RagSourceSummary } from '@/types/rag'

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath
}

export function KnowledgeBaseSettingsSection() {
  useRefreshSettings()

  const { providers, decryptApiKeys } = useSettingsStore()
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [sources, setSources] = useState<RagSourceSummary[]>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [isIndexing, setIsIndexing] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [removingSourceId, setRemovingSourceId] = useState<string | null>(null)

  const lmstudioConfig = useMemo(
    () => providers.find((provider) => provider.id === 'lmstudio'),
    [providers]
  )

  const refreshSources = useCallback(async () => {
    try {
      const nextSources = await window.electronAPI.rag.listSources()
      setSources(nextSources)
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '读取知识库失败')
    }
  }, [])

  useEffect(() => {
    void refreshSources()
  }, [refreshSources])

  const resolveRunnableLMStudioConfig = useCallback(async (): Promise<(ProviderConfig & { embeddingModel: string }) | null> => {
    await decryptApiKeys()
    const latestSettings = useSettingsStore.getState()
    const config = latestSettings.providers.find((provider) => provider.id === 'lmstudio')

    if (!config) {
      setError('未找到 LMStudio 配置，请先在设置中配置 Provider。')
      return null
    }

    const runnableConfig: ProviderConfig & { embeddingModel: string } = {
      ...config,
      apiKey:
        latestSettings.getDecryptedApiKey('lmstudio') ||
        (typeof config.apiKey === 'string' ? config.apiKey : ''),
      embeddingModel: config.embeddingModel || 'nomic-embed-text-v1.5',
    }

    const validationError = getProviderValidationError(runnableConfig)
    if (validationError) {
      setError(validationError)
      return null
    }

    if (!runnableConfig.embeddingModel.trim()) {
      setError('请先在 LMStudio 设置中配置嵌入模型。')
      return null
    }

    return runnableConfig
  }, [decryptApiKeys])

  const handleSelectFiles = async () => {
    const filePaths = await window.electronAPI.rag.selectFiles()
    if (filePaths.length === 0) {
      return
    }

    setSelectedFiles(filePaths)
    setStatus(`已选择 ${filePaths.length} 个文件`)
    setError('')
  }

  const handleIndexFiles = async () => {
    if (selectedFiles.length === 0 || isIndexing) {
      return
    }

    const providerConfig = await resolveRunnableLMStudioConfig()
    if (!providerConfig) {
      return
    }

    setIsIndexing(true)
    setStatus('正在建立知识库索引...')
    setError('')

    try {
      const result = await window.electronAPI.rag.indexFiles({
        filePaths: selectedFiles,
        providerConfig,
        embeddingModel: providerConfig.embeddingModel,
      })
      setSources(result.sources)
      setSelectedFiles([])
      setStatus(`索引完成：新增/更新 ${result.indexedChunks} 个文本块`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '索引失败')
    } finally {
      setIsIndexing(false)
    }
  }

  const handleRemoveSource = async (sourceId: string) => {
    setRemovingSourceId(sourceId)
    setError('')
    try {
      const nextSources = await window.electronAPI.rag.removeSource(sourceId)
      setSources(nextSources)
      setStatus('已删除知识源')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '删除失败')
    } finally {
      setRemovingSourceId(null)
    }
  }

  const handleClearSources = async () => {
    if (sources.length === 0 || isClearing) {
      return
    }

    if (!window.confirm('确定清空整个知识库吗？此操作不可撤销。')) {
      return
    }

    setIsClearing(true)
    setError('')
    try {
      const nextSources = await window.electronAPI.rag.clearSources()
      setSources(nextSources)
      setSelectedFiles([])
      setStatus('知识库已清空')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '清空失败')
    } finally {
      setIsClearing(false)
    }
  }

  const totalChunks = sources.reduce((sum, source) => sum + source.chunkCount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-black/30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
            <Database className="h-5 w-5 text-[#4a9eff]" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-50">知识库管理</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {sources.length} 个文档，{totalChunks} 个文本块
            </div>
          </div>
        </div>

        <button
          onClick={() => void refreshSources()}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
        >
          <RefreshCw className="h-4 w-4" />
          刷新
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-black/30">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void handleSelectFiles()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <FilePlus2 className="h-4 w-4" />
            选择文件
          </button>
          <button
            onClick={() => void handleIndexFiles()}
            disabled={selectedFiles.length === 0 || isIndexing}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition',
              selectedFiles.length === 0 || isIndexing
                ? 'cursor-not-allowed bg-slate-300 dark:bg-slate-700'
                : 'bg-[#2563eb] hover:bg-[#1d4ed8]'
            )}
          >
            {isIndexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            索引文件
          </button>
          <button
            onClick={() => void handleClearSources()}
            disabled={sources.length === 0 || isClearing}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium transition',
              sources.length === 0 || isClearing
                ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                : 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60'
            )}
          >
            {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            清空全部
          </button>
        </div>

        {selectedFiles.length > 0 && (
          <div className="mt-3 space-y-1">
            {selectedFiles.map((filePath) => (
              <div
                key={filePath}
                className="truncate rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400"
              >
                {getFileName(filePath)}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {status || '选择文件后建立知识库索引'}
        </div>
        {error && <div className="mt-2 text-xs text-red-500">{error}</div>}
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
          嵌入模型：{lmstudioConfig?.embeddingModel || 'nomic-embed-text-v1.5'}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-black/30">
        <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-50">知识源列表</div>
        <div className="space-y-2">
          {sources.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              暂无知识源
            </div>
          ) : (
            sources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3 dark:border-slate-700"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#22C55E]" />
                    <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {source.name}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {source.chunkCount} 个文本块
                  </div>
                </div>
                <button
                  onClick={() => void handleRemoveSource(source.id)}
                  disabled={removingSourceId === source.id}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  {removingSourceId === source.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  删除
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
