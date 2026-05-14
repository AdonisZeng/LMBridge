import {
  CheckCircle2,
  ChevronDown,
  Code2,
  Loader2,
  Route,
  ShieldAlert,
  Sparkles,
  Terminal,
  Wrench,
  XCircle,
} from 'lucide-react'
import type { AgentConversationItem } from './agent-conversation'

type ActivityItem = Extract<
  AgentConversationItem,
  { type: 'plan' | 'tool' | 'skill' | 'script' }
>

type ApprovalItem = Extract<AgentConversationItem, { type: 'approval' }>

interface AgentActivityCardProps {
  item: ActivityItem
}

interface AgentApprovalCardProps {
  item: ApprovalItem
  activeTaskId: string | null
  onApprove: (actionId: string) => void
  onReject: (actionId: string) => void
}

export function AgentActivityCard({ item }: AgentActivityCardProps) {
  if (item.type === 'skill') {
    return (
      <article className="rounded-[22px] border border-sky-200/80 bg-sky-50/80 px-4 py-3 shadow-[0_14px_34px_rgba(14,165,233,0.12)] backdrop-blur-xl dark:border-sky-900/70 dark:bg-black">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              选中 Skill
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {item.name ?? item.skillId}
              <span className="ml-2 rounded-full border border-sky-200/80 bg-white/70 px-2 py-0.5 text-[11px] text-sky-700 dark:border-sky-800/80 dark:bg-black dark:text-sky-200">
                {item.skillId}
              </span>
            </p>
          </div>
        </div>
      </article>
    )
  }

  const icon = getActivityIcon(item)
  const title = getActivityTitle(item)
  const subtitle = getActivitySubtitle(item)

  return (
    <details
      open
      className="group overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/80 shadow-[0_18px_44px_rgba(148,163,184,0.16)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-black dark:shadow-[0_20px_48px_rgba(2,6,23,0.34)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#4a9eff]/10 text-[#4a9eff]">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
              {title}
            </div>
            {subtitle ? (
              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {'status' in item ? <StatusPill status={item.status} /> : null}
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="border-t border-slate-200/70 px-4 py-4 dark:border-slate-700/70">
        {item.type === 'plan' ? <PlanBody steps={item.steps} /> : null}
        {item.type === 'tool' ? <ToolBody item={item} /> : null}
        {item.type === 'script' ? <ScriptBody item={item} /> : null}
      </div>
    </details>
  )
}

export function AgentApprovalCard({
  item,
  activeTaskId,
  onApprove,
  onReject,
}: AgentApprovalCardProps) {
  return (
    <article className="rounded-[24px] border border-amber-300/80 bg-amber-50/90 p-4 shadow-[0_18px_44px_rgba(245,158,11,0.16)] backdrop-blur-xl dark:border-amber-800/70 dark:bg-black">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            {item.title}
          </div>
          <p className="mt-2 text-sm leading-6 text-amber-900/80 dark:text-amber-100/80">
            {item.details}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => onApprove(item.actionId)}
              disabled={!activeTaskId}
              className="rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-600/20 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-amber-900/40 disabled:text-amber-100/50"
            >
              批准继续
            </button>
            <button
              onClick={() => onReject(item.actionId)}
              disabled={!activeTaskId}
              className="rounded-2xl border border-amber-300/80 bg-white/60 px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:text-amber-900/40 dark:border-amber-800/70 dark:bg-black dark:text-amber-100 dark:hover:bg-black"
            >
              拒绝
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

function PlanBody({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step, index) => (
        <li
          key={`${step}-${index}`}
          className="flex gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700/70 dark:bg-black"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4a9eff]/10 text-xs font-semibold text-[#4a9eff]">
            {index + 1}
          </span>
          <span className="text-sm leading-6 text-slate-700 dark:text-slate-200">
            {step}
          </span>
        </li>
      ))}
    </ol>
  )
}

function ToolBody({ item }: { item: Extract<ActivityItem, { type: 'tool' }> }) {
  return (
    <div className="space-y-3">
      <JsonBlock title="Arguments" value={item.arguments ?? '无参数'} />
      <JsonBlock
        title="Result"
        value={item.result === undefined ? '等待工具返回结果...' : item.result}
        accent="blue"
      />
    </div>
  )
}

function ScriptBody({ item }: { item: Extract<ActivityItem, { type: 'script' }> }) {
  return (
    <div className="space-y-3">
      {item.command || item.runner ? (
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-xs text-slate-500 dark:border-slate-700/70 dark:bg-black dark:text-slate-400">
          {item.runner ? <span>运行时：{item.runner}</span> : null}
          {item.runner && item.command ? <span className="mx-2">/</span> : null}
          {item.command ? <span>命令：{item.command}</span> : null}
        </div>
      ) : null}
      <pre className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200/70 bg-slate-950 px-4 py-3 text-xs leading-6 text-sky-100 shadow-inner dark:border-slate-700/70 dark:bg-black">
        {item.output.length > 0 ? item.output.join('\n\n') : '等待脚本输出...'}
      </pre>
    </div>
  )
}

function JsonBlock({
  title,
  value,
  accent = 'slate',
}: {
  title: string
  value: unknown
  accent?: 'slate' | 'blue'
}) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {title}
      </div>
      <pre
        className={`max-h-72 overflow-x-auto rounded-2xl border px-4 py-3 text-xs leading-6 shadow-inner ${
          accent === 'blue'
            ? 'border-sky-200/70 bg-sky-50/80 text-sky-900 dark:border-sky-900/70 dark:bg-black dark:text-sky-100'
            : 'border-slate-200/70 bg-slate-50/80 text-slate-700 dark:border-slate-700/70 dark:bg-black dark:text-slate-200'
        }`}
      >
        {stringifyValue(value)}
      </pre>
    </div>
  )
}

function StatusPill({ status }: { status: 'running' | 'success' | 'error' | 'unknown' }) {
  const content = {
    running: {
      label: '执行中',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      className:
        'border-amber-200 bg-amber-100/80 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/50 dark:text-amber-200',
    },
    success: {
      label: '完成',
      icon: <CheckCircle2 className="h-3 w-3" />,
      className:
        'border-emerald-200 bg-emerald-100/80 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-200',
    },
    error: {
      label: '失败',
      icon: <XCircle className="h-3 w-3" />,
      className:
        'border-red-200 bg-red-100/80 text-red-800 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-200',
    },
    unknown: {
      label: '未知',
      icon: <Code2 className="h-3 w-3" />,
      className:
        'border-slate-200 bg-slate-100/80 text-slate-600 dark:border-slate-700/70 dark:bg-slate-950/50 dark:text-slate-300',
    },
  }[status]

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${content.className}`}
    >
      {content.icon}
      {content.label}
    </span>
  )
}

function getActivityIcon(item: ActivityItem) {
  if (item.type === 'plan') {
    return <Route className="h-4 w-4" />
  }

  if (item.type === 'tool') {
    return <Wrench className="h-4 w-4" />
  }

  return <Terminal className="h-4 w-4" />
}

function getActivityTitle(item: ActivityItem): string {
  if (item.type === 'plan') {
    return '计划步骤'
  }

  if (item.type === 'tool') {
    return `MCP 调用：${item.name}`
  }

  if (item.type === 'script') {
    return `脚本执行：${item.label}`
  }

  return '选中 Skill'
}

function getActivitySubtitle(item: ActivityItem): string {
  if (item.type === 'plan') {
    return `${item.steps.length} 个步骤，会随 Agent 后续决策更新`
  }

  if (item.type === 'tool') {
    return item.summary ?? '工具参数与结果已展开'
  }

  if (item.type === 'script') {
    return item.command ?? '脚本输出日志已展开'
  }

  return item.skillId
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
