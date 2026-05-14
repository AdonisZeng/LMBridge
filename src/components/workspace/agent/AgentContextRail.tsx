import type { ReactNode } from 'react'
import { Activity, Route, ShieldCheck, Sparkles, Terminal } from 'lucide-react'
import type { AgentExecutionMode, AgentTaskStatus } from '@/types/agent'
import { cn } from '@/lib/utils'

interface AgentContextRailProps {
  status: AgentTaskStatus | 'idle'
  mode: AgentExecutionMode
  providerName: string
  connectedServerCount: number
  plan: string[]
  selectedSkills: string[]
  logs: string[]
  onModeChange: (mode: AgentExecutionMode) => void
}

const modeDescriptions: Record<AgentExecutionMode, string> = {
  auto: '默认自动调用',
  'confirm-external': '外部操作先确认',
}

const statusLabels: Record<AgentTaskStatus | 'idle', string> = {
  idle: '空闲',
  running: '执行中',
  'awaiting-approval': '等待确认',
  completed: '已完成',
  failed: '失败',
  rejected: '已拒绝',
}

export function AgentContextRail({
  status,
  mode,
  providerName,
  connectedServerCount,
  plan,
  selectedSkills,
  logs,
  onModeChange,
}: AgentContextRailProps) {
  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-t border-slate-200/75 bg-white/50 p-4 backdrop-blur-xl dark:border-slate-700/70 dark:bg-black xl:border-l xl:border-t-0">
      <RailCard>
        <div className="flex items-center justify-between gap-3">
          <RailTitle icon={<Activity className="h-4 w-4" />} label="运行状态" />
          <span className={getStatusClass(status)}>{statusLabels[status]}</span>
        </div>
        <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <InfoRow label="Provider" value={providerName} />
          <InfoRow label="MCP" value={`${connectedServerCount} 个已连接`} />
          <InfoRow label="模式" value={modeDescriptions[mode]} />
        </div>
      </RailCard>

      <RailCard>
        <RailTitle icon={<ShieldCheck className="h-4 w-4" />} label="执行模式" />
        <div className="mt-3 grid gap-2">
          {(['auto', 'confirm-external'] as AgentExecutionMode[]).map((option) => {
            const active = option === mode
            return (
              <button
                key={option}
                type="button"
                onClick={() => onModeChange(option)}
                className={cn(
                  'rounded-2xl border px-3 py-2 text-left text-xs transition',
                  active
                    ? 'border-[#4a9eff]/70 bg-[#4a9eff]/10 text-slate-900 shadow-[0_0_0_1px_rgba(74,158,255,0.14)] dark:bg-black dark:text-slate-50'
                    : 'border-slate-200/80 bg-white/60 text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-700/70 dark:bg-black dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100'
                )}
              >
                <div className="font-semibold">
                  {option === 'auto' ? '自动执行' : '外部操作先确认'}
                </div>
                <p className="mt-1 leading-5">
                  {option === 'auto'
                    ? '适合日常助手型任务，减少确认打断。'
                    : '工具调用或脚本执行前暂停一次。'}
                </p>
              </button>
            )
          })}
        </div>
      </RailCard>

      <RailCard>
        <RailTitle icon={<Route className="h-4 w-4" />} label="计划步骤" />
        {plan.length > 0 ? (
          <ol className="mt-3 space-y-2">
            {plan.map((step, index) => (
              <li
                key={`${step}-${index}`}
                className="flex gap-2 rounded-2xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-700/70 dark:bg-black dark:text-slate-300"
              >
                <span className="font-semibold text-[#4a9eff]">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyRailText>等待 Agent 生成计划。</EmptyRailText>
        )}
      </RailCard>

      <RailCard>
        <RailTitle icon={<Sparkles className="h-4 w-4" />} label="选中的 Skill" />
        {selectedSkills.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedSkills.map((skill, index) => (
              <span
                key={`${skill}-${index}`}
                className="rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs font-medium text-sky-700 dark:border-sky-900/70 dark:bg-black dark:text-sky-200"
              >
                {skill}
              </span>
            ))}
          </div>
        ) : (
          <EmptyRailText>当前还没有触发 Skill。</EmptyRailText>
        )}
      </RailCard>

      <RailCard className="min-h-[220px]">
        <RailTitle icon={<Terminal className="h-4 w-4" />} label="执行日志" />
        <pre className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-slate-200/70 bg-slate-950 px-3 py-3 text-xs leading-6 text-sky-100 shadow-inner dark:border-slate-700/70 dark:bg-black">
          {logs.length > 0 ? logs.join('\n\n') : '等待日志输出...'}
        </pre>
      </RailCard>
    </aside>
  )
}

function RailCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-[22px] border border-white/75 bg-white/70 p-4 shadow-[0_14px_34px_rgba(148,163,184,0.12)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-black',
        className
      )}
    >
      {children}
    </section>
  )
}

function RailTitle({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
      <span className="text-[#4a9eff]">{icon}</span>
      {label}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs dark:border-slate-700/70 dark:bg-black">
      <span className="text-slate-400">{label}</span>
      <span className="truncate font-medium text-slate-700 dark:text-slate-200">
        {value}
      </span>
    </div>
  )
}

function EmptyRailText({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded-2xl border border-dashed border-slate-200/80 bg-white/40 px-3 py-3 text-xs leading-5 text-slate-400 dark:border-slate-700/70 dark:bg-black">
      {children}
    </p>
  )
}

function getStatusClass(status: AgentTaskStatus | 'idle'): string {
  const base = 'rounded-full border px-2.5 py-1 text-[11px] font-semibold'

  if (status === 'completed') {
    return `${base} border-emerald-200 bg-emerald-100/80 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-200`
  }

  if (status === 'failed' || status === 'rejected') {
    return `${base} border-red-200 bg-red-100/80 text-red-800 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-200`
  }

  if (status === 'awaiting-approval') {
    return `${base} border-amber-200 bg-amber-100/80 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/50 dark:text-amber-200`
  }

  if (status === 'running') {
    return `${base} border-sky-200 bg-sky-100/80 text-sky-800 dark:border-sky-800/70 dark:bg-sky-950/50 dark:text-sky-200`
  }

  return `${base} border-slate-200 bg-slate-100/80 text-slate-500 dark:border-slate-700/70 dark:bg-slate-950/50 dark:text-slate-300`
}
