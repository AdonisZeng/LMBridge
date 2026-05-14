import { Layers3, Power, PowerOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useModuleStore } from '@/lib/store'
import { getAllModules, resolveModuleEnabled } from '@/modules'

const categoryLabels = {
  assistant: '助手',
  automation: '自动化',
  integration: '集成',
} as const

export function ModuleSettingsSection() {
  const { moduleStates, setModuleEnabled } = useModuleStore()
  const modules = getAllModules()
  const enabledModules = modules.filter((module) => resolveModuleEnabled(module, moduleStates))

  const handleToggle = (moduleId: string, enabled: boolean, locked: boolean) => {
    if (locked) {
      return
    }

    setModuleEnabled(moduleId, !enabled)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-[#1E293B] bg-[#1E293B]/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1E293B] border border-[#334155] flex items-center justify-center">
            <Layers3 size={18} className="text-[#4a9eff]" />
          </div>
          <div>
            <div className="text-sm font-medium text-[#F8FAFC]">模块注册中心</div>
            <div className="text-xs text-[#64748b]">
              已启用 {enabledModules.length} / {modules.length} 个模块
            </div>
          </div>
        </div>
        <div className="text-xs text-[#475569]">模块入口已改为注册式装配</div>
      </div>

      <div className="space-y-3">
        {modules.map((module) => {
          const enabled = resolveModuleEnabled(module, moduleStates)
          const isLastEnabled = enabled && enabledModules.length === 1
          const locked = module.canDisable === false || isLastEnabled
          const Icon = module.icon

          return (
            <div
              key={module.id}
              className={cn(
                'rounded-xl border p-4 transition-all duration-200',
                enabled
                  ? 'border-[#334155] bg-[#1E293B]/60'
                  : 'border-[#1E293B] bg-[#0F172A]/60 opacity-85'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0',
                      enabled
                        ? 'bg-[#1E293B] border-[#334155] text-[#4a9eff]'
                        : 'bg-[#111827] border-[#1E293B] text-[#64748b]'
                    )}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[#F8FAFC]">{module.label}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#0F172A] text-[#94a3b8] border border-[#334155]">
                        {categoryLabels[module.category]}
                      </span>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] border',
                          enabled
                            ? 'border-[#14532d] bg-[#052e16] text-[#86efac]'
                            : 'border-[#3f3f46] bg-[#18181b] text-[#a1a1aa]'
                        )}
                      >
                        {enabled ? '已启用' : '已禁用'}
                      </span>
                    </div>
                    <p className="text-xs text-[#94a3b8] mt-2 leading-relaxed">
                      {module.description}
                    </p>
                    {module.tags && module.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {module.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-md text-[10px] bg-[#0F172A] text-[#64748b] border border-[#1E293B]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleToggle(module.id, enabled, locked)}
                  disabled={locked}
                  className={cn(
                    'h-10 px-3 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all duration-200',
                    locked
                      ? 'border-[#1E293B] bg-[#111827] text-[#475569] cursor-not-allowed'
                      : enabled
                        ? 'border-[#7f1d1d] bg-[#450a0a] text-[#fca5a5] hover:bg-[#5f0f0f]'
                        : 'border-[#14532d] bg-[#052e16] text-[#86efac] hover:bg-[#064e1f]'
                  )}
                  title={locked ? '请至少保留一个启用中的模块' : enabled ? '禁用模块' : '启用模块'}
                >
                  {enabled ? <PowerOff size={14} /> : <Power size={14} />}
                  {enabled ? '禁用' : '启用'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
