import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ProviderConfig, APICompatibility } from '@/lib/providers'
import { cn } from '@/lib/utils'

interface CustomPanelProps {
  config: ProviderConfig
  onSave: (updates: Partial<ProviderConfig>) => void
  onClose: () => void
}

const apiTypeLabels: Record<APICompatibility, string> = {
  openai: 'OpenAI 兼容',
  anthropic: 'Anthropic 兼容',
  custom: '自定义',
}

export function CustomPanel({ config, onSave, onClose }: CustomPanelProps) {
  const [baseURL, setBaseURL] = useState(config.baseURL)
  const [apiKey, setApiKey] = useState(config.apiKey)
  const [model, setModel] = useState(config.model)
  const [apiType, setApiType] = useState<APICompatibility>(config.apiType)

  const handleSave = () => {
    onSave({ baseURL, apiKey, model, apiType })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[#858585] text-xs mb-2">基地址</label>
        <input
          type="text"
          value={baseURL}
          onChange={(e) => setBaseURL(e.target.value)}
          placeholder="https://api.example.com/v1"
          className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-[#ccc] placeholder-[#666] focus:outline-none focus:border-[#4a9eff]"
        />
      </div>

      <div>
        <label className="block text-[#858585] text-xs mb-2">API 兼容类型</label>
        <div className="flex gap-2">
          {(['openai', 'anthropic', 'custom'] as APICompatibility[]).map((type) => (
            <button
              key={type}
              onClick={() => setApiType(type)}
              className={cn(
                'px-3 py-1.5 rounded text-xs transition-colors',
                apiType === type
                  ? 'bg-[#4a9eff] text-white'
                  : 'bg-[#333] text-[#aaa] hover:bg-[#444]'
              )}
            >
              {apiTypeLabels[type]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[#858585] text-xs mb-2">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-[#ccc] placeholder-[#666] focus:outline-none focus:border-[#4a9eff]"
        />
      </div>

      <div>
        <label className="block text-[#858585] text-xs mb-2">使用模型</label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="model-name"
          className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-[#ccc] placeholder-[#666] focus:outline-none focus:border-[#4a9eff]"
        />
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
