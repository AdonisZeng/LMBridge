import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { ChatWorkspace } from '@/components/chat/ChatWorkspace'
import { type AppView, DEFAULT_APP_VIEW } from '@/components/layout/app-navigation'
import { IconBar } from '@/components/layout/IconBar'
import { SettingsWindow } from '@/components/settings/SettingsWindow'
import { useSettingsStore } from '@/lib/store'
import { applyThemeToDocument } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/lib/constants'

function App() {
  const { theme, setTheme } = useSettingsStore()
  const [activeView, setActiveView] = useState<AppView>(DEFAULT_APP_VIEW)

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])
  const ActiveView = activeView === 'settings' ? SettingsWindow : ChatWorkspace

  return (
    <div className="h-screen bg-background text-foreground transition-colors duration-200">
      <div className="h-screen flex overflow-hidden bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-[#0F172A] dark:text-slate-50">
        <IconBar activeView={activeView} onViewChange={setActiveView} />

        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-12 flex items-center justify-between px-4 border-b border-slate-200 bg-white/85 backdrop-blur-sm transition-colors duration-200 dark:border-[#1E293B] dark:bg-[#0F172A]/80">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#22C55E] to-[#16a34a] flex items-center justify-center shadow-lg shadow-[#22C55E]/20">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <span className="font-semibold tracking-tight text-slate-900 dark:text-[#F8FAFC]">
                {APP_NAME}
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className={cn(
                'relative w-10 h-10 rounded-xl',
                'flex items-center justify-center',
                'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-100',
                'dark:bg-[#1E293B] dark:hover:bg-[#334155]',
                'dark:border-[#334155] dark:hover:border-[#475569]',
                'transition-all duration-200 ease-out',
                'hover:scale-105 active:scale-95',
                'group'
              )}
              aria-label="切换主题"
            >
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-slate-500 transition-colors duration-200 group-hover:text-slate-900 dark:text-[#94a3b8] dark:group-hover:text-[#F8FAFC]" />
              ) : (
                <Sun className="w-5 h-5 text-amber-500 transition-colors duration-200 group-hover:text-amber-600" />
              )}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#22C55E]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <ActiveView />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
