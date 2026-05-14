import type { KeyboardEvent } from 'react'
import { Send, SlidersHorizontal, Square } from 'lucide-react'
import type { AgentExecutionMode } from '@/types/agent'
import { cn } from '@/lib/utils'
import {
  getComposerActionButtonClass,
  getComposerRowClass,
  getComposerShellClass,
  getComposerTextareaClass,
} from '@/components/chat/composer-surface-styles'

interface AgentComposerProps {
  value: string
  mode: AgentExecutionMode
  providerName: string
  connectedServerCount: number
  isBusy: boolean
  onChange: (value: string) => void
  onModeChange: (mode: AgentExecutionMode) => void
  onSubmit: () => void
  onCancel: () => void
}

const modeOptions: Array<{
  id: AgentExecutionMode
  label: string
  title: string
}> = [
  {
    id: 'auto',
    label: '自动',
    title: '默认自动调用 MCP 工具和 Skill',
  },
  {
    id: 'confirm-external',
    label: '确认',
    title: '外部操作前先确认一次',
  },
]

export function AgentComposer({
  value,
  mode,
  providerName,
  connectedServerCount,
  isBusy,
  onChange,
  onModeChange,
  onSubmit,
  onCancel,
}: AgentComposerProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className={getComposerShellClass()}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-xs text-slate-500 shadow-sm backdrop-blur-xl dark:border-slate-700/70 dark:bg-black dark:text-slate-400">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Provider：{providerName}</span>
            <span className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
            <span>MCP：{connectedServerCount} 个已连接</span>
          </div>

          <div className="flex rounded-full border border-white/80 bg-white/70 p-1 shadow-sm backdrop-blur-xl dark:border-slate-700/70 dark:bg-black">
            {modeOptions.map((option) => {
              const active = option.id === mode
              return (
                <button
                  key={option.id}
                  type="button"
                  title={option.title}
                  aria-pressed={active}
                  onClick={() => onModeChange(option.id)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition',
                    active
                      ? 'bg-[#4a9eff] text-white shadow-sm shadow-blue-500/20'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-black dark:hover:text-slate-100'
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className={getComposerRowClass()}>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="给 Agent 一个任务... 例如：读取 package.json，总结项目结构，并说明 MCP 与 Skill 如何协同。"
            className={getComposerTextareaClass()}
            rows={1}
          />
          {value.length > 0 ? (
            <div className="absolute bottom-2 right-16 text-xs text-slate-400 dark:text-slate-600">
              {value.length}
            </div>
          ) : null}
          {isBusy ? (
            <button
              onClick={onCancel}
              className={getComposerActionButtonClass('stop', false)}
              title="停止 Agent"
            >
              <Square size={18} />
            </button>
          ) : (
            <button
              onClick={onSubmit}
              disabled={!value.trim()}
              className={getComposerActionButtonClass('send', !value.trim())}
              title="发送给 Agent"
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
