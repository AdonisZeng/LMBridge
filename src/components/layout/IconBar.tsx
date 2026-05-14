import { cn } from '@/lib/utils'
import { Sparkles } from 'lucide-react'
import { APP_NAVIGATION_ITEMS, type AppView } from './app-navigation'

interface IconBarProps {
  activeView: AppView
  onViewChange: (view: AppView) => void
}

const iconButtonClass = (isActive: boolean) =>
  cn(
    'relative w-11 h-11 rounded-xl flex items-center justify-center',
    'transition-all duration-200 ease-out cursor-pointer',
    isActive
      ? [
          'bg-gradient-to-br from-[#4a9eff] to-[#3b82f6]',
          'text-white',
          'shadow-lg shadow-[#4a9eff]/30',
          'scale-105',
        ]
      : [
          'bg-transparent text-slate-500 hover:bg-slate-200 hover:text-slate-700',
          'dark:text-[#64748b]',
          'dark:hover:text-[#94a3b8]',
          'dark:hover:bg-[#1E293B]',
          'hover:scale-105',
        ]
  )

export function IconBar({ activeView, onViewChange }: IconBarProps) {
  const renderNavigationButton = (view: (typeof APP_NAVIGATION_ITEMS)[number]) => {
    const Icon = view.icon
    const isActive = activeView === view.id

    return (
      <button
        key={view.id}
        onClick={() => onViewChange(view.id)}
        className={iconButtonClass(isActive)}
        title={view.label}
        aria-label={view.label}
        aria-current={isActive ? 'page' : undefined}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#22C55E] rounded-r-full shadow-md shadow-[#22C55E]/50" />
        )}
        <Icon size={20} />
      </button>
    )
  }

  return (
    <div className="w-16 h-full flex flex-col items-center py-4 gap-2 border-r border-slate-200 bg-slate-100/80 transition-colors duration-200 dark:border-[#1E293B] dark:bg-[#0F172A]/50">
      <div className="mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#22C55E] to-[#16a34a] flex items-center justify-center shadow-lg shadow-[#22C55E]/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
      </div>

      <div className="w-8 h-px bg-slate-300 dark:bg-[#1E293B]" />

      <div className="flex flex-col gap-2 mt-3">{APP_NAVIGATION_ITEMS.map(renderNavigationButton)}</div>
    </div>
  )
}
