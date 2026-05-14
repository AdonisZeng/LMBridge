import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LMStudioProvider, type LMStudioModel } from '@/lib/providers/lmstudio'
import type { ProviderConfig } from '@/lib/providers'

interface LMStudioPanelProps {
  config: ProviderConfig
  onSave: (updates: Partial<ProviderConfig>) => void
  onClose: () => void
}

export function LMStudioPanel({ config, onSave, onClose }: LMStudioPanelProps) {
  const [baseURL, setBaseURL] = useState(config.baseURL)
  const [model, setModel] = useState(config.model)
  const [embeddingModel, setEmbeddingModel] = useState(config.embeddingModel || '')
  const [models, setModels] = useState<LMStudioModel[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  useEffect(() => {
    if (baseURL) {
      setLoadingModels(true)
      LMStudioProvider.fetchModels(baseURL)
        .then((fetchedModels) => {
          setModels(fetchedModels)
          if (fetchedModels.length > 0 && !model) {
            setModel(fetchedModels[0].id)
          }
        })
        .finally(() => setLoadingModels(false))
    }
  }, [baseURL, model])

  const handleSave = () => {
    onSave({ baseURL, model, embeddingModel })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[#858585] text-xs mb-2">服务器地址</label>
        <input
          type="text"
          value={baseURL}
          onChange={(e) => setBaseURL(e.target.value)}
          placeholder="http://127.0.0.1:1234/v1"
          className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-[#ccc] placeholder-[#666] focus:outline-none focus:border-[#4a9eff]"
        />
        <p className="text-[#666] text-xs mt-1">默认: http://127.0.0.1:1234/v1</p>
      </div>

      <div>
        <label className="block text-[#858585] text-xs mb-2">选择LLM模型</label>
        {loadingModels ? (
          <div className="flex items-center gap-2 text-[#666] text-sm">
            <Loader2 size={14} className="animate-spin" />
            正在获取模型列表...
          </div>
        ) : models.length > 0 ? (
          <div className="space-y-2">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-[#ccc] focus:outline-none focus:border-[#4a9eff]"
            >
              <option value="">选择模型...</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="text-[#666] text-xs">已发现 {models.length} 个模型</p>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="输入模型名称"
              className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-[#ccc] placeholder-[#666] focus:outline-none focus:border-[#4a9eff]"
            />
            <p className="text-[#666] text-xs">无法获取模型列表，请确保 LMStudio 已启动并加载模型</p>
          </div>
        )}
      </div>

      <div>
        <label className="block text-[#858585] text-xs mb-2">选择嵌入模型</label>
        {loadingModels ? (
          <div className="flex items-center gap-2 text-[#666] text-sm">
            <Loader2 size={14} className="animate-spin" />
            正在获取模型列表...
          </div>
        ) : models.length > 0 ? (
          <div className="space-y-2">
            <select
              value={embeddingModel}
              onChange={(e) => setEmbeddingModel(e.target.value)}
              className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-[#ccc] focus:outline-none focus:border-[#4a9eff]"
            >
              <option value="">选择嵌入模型...</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="text-[#666] text-xs">用于知识库向量化的嵌入模型</p>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={embeddingModel}
              onChange={(e) => setEmbeddingModel(e.target.value)}
              placeholder="输入嵌入模型名称 (如: nomic-embed-text-v1.5)"
              className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-[#ccc] placeholder-[#666] focus:outline-none focus:border-[#4a9eff]"
            />
            <p className="text-[#666] text-xs">无法获取模型列表，请手动输入嵌入模型名称</p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-[#3c3c3c]">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-[#ccc]">
          取消
        </Button>
        <Button size="sm" onClick={handleSave} className="bg-[#4a9eff] hover:bg-[#3d8bdb]">
          保存
        </Button>
      </div>
    </div>
  )
}
