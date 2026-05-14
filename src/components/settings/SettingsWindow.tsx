import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { rendererLogger } from '@/lib/logger'
import { applyThemeToDocument } from '@/lib/theme'
import { useSettingsStore } from '@/lib/store'
import { KnowledgeBaseSettingsSection } from './KnowledgeBaseSettingsSection'
import { MCPServersSection } from './MCPServersSection'
import { ProviderSettingsSection } from './ProviderSettingsSection'
import { WebSearchSettingsSection } from './WebSearchSettingsSection'
import { SETTINGS_SECTIONS, type SettingsSectionId } from './settings-sections'

const tabClass = (isActive: boolean) =>
  cn(
    'flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200',
    isActive
      ? ['bg-[#4a9eff] text-white', 'shadow-md shadow-[#4a9eff]/20']
      : ['text-[#64748b] hover:text-[#94a3b8]', 'hover:bg-[#334155]/50']
  )

export function SettingsWindow() {
  const { theme } = useSettingsStore()
  const [activeTab, setActiveTab] = useState<SettingsSectionId>('provider')

  useEffect(() => {
    rendererLogger.info('SettingsWindow 组件挂载')
  }, [])

  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  const ActiveSection =
    activeTab === 'provider'
      ? ProviderSettingsSection
      : activeTab === 'mcp'
        ? MCPServersSection
        : activeTab === 'knowledge-base'
          ? KnowledgeBaseSettingsSection
          : WebSearchSettingsSection

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-[#0F172A] dark:text-[#F8FAFC]">
      <div className="flex items-center px-4 py-3 border-b border-slate-200 bg-white transition-colors duration-200 dark:border-[#1E293B] dark:bg-[#0F172A]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#22C55E] to-[#16a34a] flex items-center justify-center shadow-lg shadow-[#22C55E]/20">
            <span className="text-white font-bold text-sm">AI</span>
          </div>
          <span className="font-semibold tracking-tight text-slate-900 dark:text-[#F8FAFC]">设置</span>
        </div>
      </div>

      <div className="p-3 border-b border-slate-200 bg-slate-50 transition-colors duration-200 dark:border-[#1E293B] dark:bg-[#0F172A]">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-200 dark:bg-[#1E293B]">
          {SETTINGS_SECTIONS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={tabClass(activeTab === tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-slate-50 transition-colors duration-200 dark:bg-[#0F172A]">
        <ActiveSection />
      </div>
    </div>
  )
}
