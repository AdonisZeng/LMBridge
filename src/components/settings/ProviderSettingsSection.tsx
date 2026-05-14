import { useState, useMemo } from 'react'
import { Check, Settings, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/lib/store'
import { ProviderSettingsModal } from '@/components/settings/ProviderSettingsModal'
import type { ProviderType } from '@/types/providers'
import type { ProviderCategory } from '@/lib/providers'
import { CATEGORY_PROVIDER_MAP, CATEGORY_LABELS } from '@/lib/providers'

export function ProviderSettingsSection() {
  const { providers, activeProviders, setActiveProvider } = useSettingsStore()
  const [settingsProvider, setSettingsProvider] = useState<{
    providerId: ProviderType
    category: ProviderCategory
  } | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<ProviderCategory>>(
    new Set(['text'])
  )

  const providerMap = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers])

  const toggleCategory = (category: ProviderCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const handleContextMenu = (e: React.MouseEvent, providerId: ProviderType, category: ProviderCategory) => {
    e.preventDefault()
    setSettingsProvider({ providerId, category })
  }

  return (
    <>
      <div className="space-y-2">
        {(Object.keys(CATEGORY_PROVIDER_MAP) as ProviderCategory[]).map((category) => {
          const categoryProviderIds = CATEGORY_PROVIDER_MAP[category]
          const isExpanded = expandedCategories.has(category)

          return (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="flex items-center gap-2 w-full text-left py-2 text-[#64748b] text-xs uppercase tracking-wider font-medium hover:text-[#94a3b8] transition-colors cursor-pointer"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {CATEGORY_LABELS[category]}
              </button>

              {isExpanded && (
                <div className="space-y-2">
                  {categoryProviderIds.map((providerId) => {
                    const provider = providerMap.get(providerId)
                    if (!provider) return null
                    const isActive = activeProviders[category] === providerId

                    return (
                      <div
                        key={providerId}
                        className="group relative"
                        onContextMenu={(e) => handleContextMenu(e, providerId, category)}
                      >
                        <button
                          onClick={() => setActiveProvider(category, providerId)}
                          onDoubleClick={() => setSettingsProvider({ providerId, category })}
                          className={cn(
                            'w-full text-left p-3 rounded-xl border transition-all duration-200 ease-out cursor-pointer',
                            isActive
                              ? [
                                  'bg-[#1E293B] border-[#4a9eff]/50 text-[#4a9eff]',
                                  'shadow-md shadow-[#4a9eff]/5',
                                ]
                              : [
                                  'bg-[#1E293B]/50 border-[#334155]',
                                  'text-[#E2E8F0]',
                                  'hover:border-[#4a9eff]/50',
                                  'hover:bg-[#1E293B]',
                                ]
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-medium">{provider.name}</span>
                              <span className="text-[#64748b] text-xs">
                                {provider.categoryModels?.[category]
                                  ? `${provider.categoryModels[category]}`
                                  : provider.model || '未配置模型'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isActive && (
                                <div className="w-5 h-5 rounded-full bg-[#22C55E] flex items-center justify-center shadow-sm shadow-[#22C55E]/30">
                                  <Check size={10} className="text-white" />
                                </div>
                              )}
                              <Settings
                                size={14}
                                className={cn(
                                  'transition-opacity duration-200',
                                  isActive
                                    ? 'text-[#4a9eff] opacity-100'
                                    : 'text-[#64748b] opacity-0 group-hover:opacity-100 hover:!opacity-100'
                                )}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSettingsProvider({ providerId, category })
                                }}
                              />
                            </div>
                          </div>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        <p className="text-[#475569] text-[10px] mt-4 text-center">
          双击或右键点击可打开详细设置
        </p>
      </div>

      {settingsProvider && (
        <ProviderSettingsModal
          providerId={settingsProvider.providerId}
          category={settingsProvider.category}
          onClose={() => setSettingsProvider(null)}
        />
      )}
    </>
  )
}
