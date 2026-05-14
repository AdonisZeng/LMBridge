import { useEffect, useState } from 'react'
import { Globe2, KeyRound, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/lib/store'
import type { WebSearchProviderId, WebSearchSafeSearch } from '@/types/web-search'

const providerOptions: Array<{ id: WebSearchProviderId; label: string; baseURL: string }> = [
  {
    id: 'brave',
    label: 'Brave Search',
    baseURL: 'https://api.search.brave.com/res/v1/web/search',
  },
  {
    id: 'tavily',
    label: 'Tavily',
    baseURL: 'https://api.tavily.com/search',
  },
  {
    id: 'searxng',
    label: 'SearXNG',
    baseURL: 'http://127.0.0.1:8888',
  },
]

const safeSearchOptions: Array<{ id: WebSearchSafeSearch; label: string }> = [
  { id: 'off', label: '关闭' },
  { id: 'moderate', label: '中等' },
  { id: 'strict', label: '严格' },
]

export function WebSearchSettingsSection() {
  const {
    webSearch,
    updateWebSearch,
    decryptWebSearchApiKey,
    getRunnableWebSearchConfig,
  } = useSettingsStore()
  const [draft, setDraft] = useState(webSearch)
  const [status, setStatus] = useState('')

  useEffect(() => {
    void decryptWebSearchApiKey().then(() => {
      setDraft(useSettingsStore.getState().getRunnableWebSearchConfig())
    })
  }, [decryptWebSearchApiKey])

  const updateProvider = (provider: WebSearchProviderId) => {
    const option = providerOptions.find((item) => item.id === provider)
    setDraft((current) => ({
      ...current,
      provider,
      baseURL: option?.baseURL ?? current.baseURL,
    }))
  }

  const save = async () => {
    await updateWebSearch(draft)
    await decryptWebSearchApiKey()
    setDraft(getRunnableWebSearchConfig())
    setStatus('联网搜索设置已保存')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#1E293B] dark:bg-[#111827]">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-[#F8FAFC]">
          <Globe2 className="h-4 w-4 text-[#4a9eff]" />
          <span>联网搜索</span>
        </div>

        <label className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3 text-sm dark:border-[#334155]">
          <span className="text-slate-700 dark:text-[#CBD5E1]">启用联网搜索</span>
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
            className="h-4 w-4"
          />
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#1E293B] dark:bg-[#111827]">
        <div className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-[#64748b]">
          搜索提供商
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {providerOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => updateProvider(option.id)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left text-sm transition',
                draft.provider === option.id
                  ? 'border-[#4a9eff] bg-[#4a9eff]/10 text-[#4a9eff]'
                  : 'border-slate-200 text-slate-600 hover:border-[#4a9eff]/60 dark:border-[#334155] dark:text-[#CBD5E1]'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-[#1E293B] dark:bg-[#111827]">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500 dark:text-[#94A3B8]">Base URL</span>
          <input
            value={draft.baseURL}
            onChange={(event) => setDraft((current) => ({ ...current, baseURL: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#4a9eff] dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#F8FAFC]"
          />
        </label>

        <label className="block">
          <span className="mb-1 flex items-center gap-1 text-xs text-slate-500 dark:text-[#94A3B8]">
            <KeyRound className="h-3 w-3" />
            API Key
          </span>
          <input
            type="password"
            value={draft.apiKey}
            onChange={(event) => setDraft((current) => ({ ...current, apiKey: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#4a9eff] dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#F8FAFC]"
            placeholder={draft.provider === 'searxng' ? 'SearXNG 不需要 API Key' : '输入 API Key'}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500 dark:text-[#94A3B8]">结果数量</span>
            <input
              type="number"
              min={1}
              max={8}
              value={draft.maxResults}
              onChange={(event) => setDraft((current) => ({ ...current, maxResults: Number(event.target.value) }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#4a9eff] dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#F8FAFC]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-500 dark:text-[#94A3B8]">超时毫秒</span>
            <input
              type="number"
              min={1000}
              max={30000}
              value={draft.timeoutMs}
              onChange={(event) => setDraft((current) => ({ ...current, timeoutMs: Number(event.target.value) }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#4a9eff] dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#F8FAFC]"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500 dark:text-[#94A3B8]">国家</span>
            <input
              value={draft.country}
              onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#4a9eff] dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#F8FAFC]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-500 dark:text-[#94A3B8]">语言</span>
            <input
              value={draft.language}
              onChange={(event) => setDraft((current) => ({ ...current, language: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#4a9eff] dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#F8FAFC]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-500 dark:text-[#94A3B8]">安全搜索</span>
            <select
              value={draft.safeSearch}
              onChange={(event) =>
                setDraft((current) => ({ ...current, safeSearch: event.target.value as WebSearchSafeSearch }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#4a9eff] dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#F8FAFC]"
            >
              {safeSearchOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-[#64748b]">{status}</span>
        <button
          type="button"
          onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-lg bg-[#4a9eff] px-4 py-2 text-sm font-medium text-white shadow-md shadow-[#4a9eff]/20 transition hover:bg-[#3b8de8]"
        >
          <Save className="h-4 w-4" />
          保存
        </button>
      </div>
    </div>
  )
}
