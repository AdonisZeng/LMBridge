import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useSettingsStore } from '@/lib/store'
import type { ProviderType, ProviderCategory } from '@/lib/providers'
import { LMStudioPanel } from './provider-panels/LMStudioPanel'
import { CustomPanel } from './provider-panels/CustomPanel'

interface ProviderSettingsModalProps {
  providerId: ProviderType
  category?: ProviderCategory
  onClose: () => void
}

const panelMap: Record<string, React.FC<{
  config: import('@/lib/providers').ProviderConfig
  onSave: (updates: Partial<import('@/lib/providers').ProviderConfig>) => void
  onClose: () => void
}>> = {
  lmstudio: LMStudioPanel,
  custom: CustomPanel,
}

export function ProviderSettingsModal({ providerId, onClose }: ProviderSettingsModalProps) {
  const { providers, updateProvider, decryptApiKeys } = useSettingsStore()
  const [keysReady, setKeysReady] = useState(false)

  useEffect(() => {
    decryptApiKeys().then(() => setKeysReady(true))
  }, [decryptApiKeys])

  const provider = providers.find((p) => p.id === providerId)

  if (!provider) return null

  const Panel = panelMap[providerId]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg w-[480px] border border-[#3c3c3c]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c]">
          <span className="text-[#ccc] font-medium">{provider.name} 设置</span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#333] text-[#666] hover:text-[#aaa]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[480px] overflow-y-auto">
          {!keysReady ? (
            <div className="text-[#666] text-sm text-center py-8">
              正在解密敏感数据...
            </div>
          ) : Panel ? (
            <Panel
              config={provider}
              onSave={(updates) => {
                updateProvider(providerId, updates)
                onClose()
              }}
              onClose={onClose}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
