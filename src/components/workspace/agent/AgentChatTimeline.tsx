import { useEffect, useRef, type ReactNode } from 'react'
import { Bot, Loader2, Sparkles, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AgentTaskStatus } from '@/types/agent'
import { cn } from '@/lib/utils'
import { AgentActivityCard, AgentApprovalCard } from './AgentActivityCard'
import type { AgentConversationItem } from './agent-conversation'

interface AgentChatTimelineProps {
  items: AgentConversationItem[]
  status: AgentTaskStatus | 'idle'
  activeTaskId: string | null
  onApprove: (actionId: string) => void
  onReject: (actionId: string) => void
}

export function AgentChatTimeline({
  items,
  status,
  activeTaskId,
  onApprove,
  onReject,
}: AgentChatTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [items])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        {items.length === 0 ? <AgentWelcomeCard /> : null}

        {items.map((item) => {
          if (item.type === 'user') {
            return <UserMessage key={item.id} content={item.content} />
          }

          if (item.type === 'assistant') {
            return (
              <AssistantMessage
                key={item.id}
                content={item.content}
                tone={item.tone}
              />
            )
          }

          if (item.type === 'approval') {
            return (
              <AssistantActivityRow key={item.id}>
                <AgentApprovalCard
                  item={item}
                  activeTaskId={activeTaskId}
                  onApprove={onApprove}
                  onReject={onReject}
                />
              </AssistantActivityRow>
            )
          }

          return (
            <AssistantActivityRow key={item.id}>
              <AgentActivityCard item={item} />
            </AssistantActivityRow>
          )
        })}

        {status === 'running' ? <AgentThinkingRow /> : null}
        <div ref={endRef} />
      </div>
    </div>
  )
}

function AgentWelcomeCard() {
  return (
    <div className="mx-auto mt-6 max-w-2xl rounded-[28px] border border-white/80 bg-white/75 p-6 text-center shadow-[0_24px_60px_rgba(148,163,184,0.18)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-black dark:shadow-[0_28px_70px_rgba(2,6,23,0.34)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[22px] bg-gradient-to-br from-[#4a9eff] to-[#2563eb] text-white shadow-lg shadow-blue-500/25">
        <Bot className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-950 dark:text-slate-50">
        用聊天方式驱动 Agent
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
        直接描述任务即可。Agent 会在对话中展开计划、选中的 Skill、每次 MCP 调用和脚本执行日志。
      </p>
    </div>
  )
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex flex-row-reverse items-end gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20">
        <User className="h-5 w-5" />
      </div>
      <div className="max-w-[min(38rem,78%)] rounded-[22px] rounded-tr-[12px] bg-gradient-to-br from-[#4a9eff] to-[#2563eb] px-4 py-3 text-sm leading-7 text-white shadow-[0_18px_38px_rgba(37,99,235,0.22)]">
        {content}
      </div>
    </div>
  )
}

function AssistantMessage({
  content,
  tone,
}: {
  content: string
  tone: 'success' | 'error' | 'rejected'
}) {
  return (
    <div className="flex items-start gap-3">
      <AssistantAvatar tone={tone} />
      <div
        className={cn(
          'max-w-[min(44rem,82%)] rounded-[24px] rounded-tl-[12px] border px-4 py-3 text-sm leading-7 shadow-[0_18px_44px_rgba(148,163,184,0.16)] backdrop-blur-xl',
          tone === 'error'
            ? 'border-red-200/80 bg-red-50/80 text-red-950 dark:border-red-900/70 dark:bg-black dark:text-red-100'
            : 'border-slate-200/80 bg-white/90 text-slate-800 dark:border-slate-700/80 dark:bg-black dark:text-slate-100'
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const isInline = !className
              return isInline ? (
                <code
                  className={cn(
                    'rounded bg-slate-950 px-1 py-0.5 text-sky-200 dark:bg-black',
                    className
                  )}
                  {...props}
                >
                  {children}
                </code>
              ) : (
                <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 p-3 text-xs leading-6 text-sky-100 dark:bg-black">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              )
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}

function AssistantActivityRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <AssistantAvatar tone="success" subtle />
      <div className="w-full max-w-[min(48rem,86%)]">{children}</div>
    </div>
  )
}

function AgentThinkingRow() {
  return (
    <div className="flex items-start gap-3">
      <AssistantAvatar tone="success" subtle />
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/75 px-4 py-2 text-xs text-slate-500 shadow-sm backdrop-blur-xl dark:border-slate-700/70 dark:bg-black dark:text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Agent 正在规划下一步...
      </div>
    </div>
  )
}

function AssistantAvatar({
  tone,
  subtle = false,
}: {
  tone: 'success' | 'error' | 'rejected'
  subtle?: boolean
}) {
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg',
        tone === 'error'
          ? 'bg-gradient-to-br from-red-500 to-red-700 shadow-red-500/20'
          : 'bg-gradient-to-br from-[#4a9eff] to-[#2563eb] shadow-blue-500/20',
        subtle ? 'opacity-82' : ''
      )}
    >
      <Sparkles className="h-5 w-5" />
    </div>
  )
}
