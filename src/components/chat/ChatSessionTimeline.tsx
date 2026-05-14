import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Brain, ChevronDown, Loader2, Sparkles, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from '@/lib/providers'
import {
  getThinkingBodyClass,
  getThinkingPanelClass,
  getThinkingWrapperClass,
} from './thinking-panel-styles'
import {
  getAvatarClass,
  getMessageBubbleClass,
  getMessageColumnClass,
  getMessageRowClass,
  type ChatVisualRole,
} from './message-surface-styles'
import { getAgentOriginBadge, getSourceItems } from './chat-session-timeline-meta'

interface ChatSessionTimelineProps {
  messages: Message[]
  isGenerating: boolean
  onToggleThinking: (messageId: string) => void
}

export function ChatSessionTimeline({
  messages,
  isGenerating,
  onToggleThinking,
}: ChatSessionTimelineProps) {
  return (
    <div className="space-y-5">
      {messages.map((message, index) => {
        const visualRole: ChatVisualRole = message.role === 'user' ? 'user' : 'assistant'
        const isLatestAssistant = isGenerating && message.role === 'assistant' && index === messages.length - 1
        const agentBadge = getAgentOriginBadge(message)
        const sourceItems = getSourceItems(message)

        return (
          <div key={message.id} className={getMessageRowClass(visualRole)}>
            <div className={getAvatarClass(visualRole)}>
              {visualRole === 'assistant' ? (
                <Sparkles className="h-5 w-5" />
              ) : (
                <User className="h-5 w-5" />
              )}
            </div>

            <div className={getMessageColumnClass(visualRole)}>
              {message.thinking !== undefined && message.thinking !== null && (
                <div className="w-full">
                  <button
                    onClick={() => onToggleThinking(message.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/78 px-3 py-1.5 text-xs font-medium text-slate-500',
                      'transition-all duration-200 hover:scale-105 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 active:scale-95',
                      'dark:border-slate-700/80 dark:bg-black dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-black dark:hover:text-slate-200'
                    )}
                  >
                    <Brain className="h-3.5 w-3.5" />
                    <span>思考过程</span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform duration-200',
                        message.thinkingExpanded ? 'rotate-180' : ''
                      )}
                    />
                  </button>

                  <div className={getThinkingWrapperClass(!!message.thinkingExpanded)}>
                    <div className={getThinkingPanelClass()}>
                      <div className="flex items-center gap-2 border-b border-slate-200/70 px-4 pt-4 pb-2 text-[11px] text-slate-500 dark:border-slate-700/70 dark:text-slate-400">
                        {isLatestAssistant ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>模型推理中...</span>
                          </>
                        ) : (
                          <>
                            <Brain className="h-3 w-3" />
                            <span>思考完成</span>
                          </>
                        )}
                      </div>
                      <div className={getThinkingBodyClass()}>
                        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-500 dark:text-slate-300">
                          {message.thinking}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className={getMessageBubbleClass(visualRole)}>
                {agentBadge && (
                  <div className="mb-2 inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200">
                    {agentBadge}
                  </div>
                )}

                {message.content ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '')
                        const isInline = !match && !className
                        return !isInline ? (
                          <SyntaxHighlighter
                            style={oneDark as Record<string, React.CSSProperties>}
                            language={match?.[1] || 'text'}
                            PreTag="div"
                            className="rounded mt-2 !bg-[#1e1e1e] !p-3 text-xs dark:!bg-black"
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code
                            className={cn(
                              'rounded bg-[#1e1e1e] px-1 py-0.5 text-[#4a9eff] dark:bg-black',
                              className
                            )}
                            {...props}
                          >
                            {children}
                          </code>
                        )
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                ) : isLatestAssistant ? (
                  <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Loader2 size={14} className="animate-spin" />
                    <span>生成中...</span>
                  </span>
                ) : null}

                {sourceItems.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {sourceItems.map((source) =>
                      source.url ? (
                        <a
                          key={source.id}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          title={source.title}
                          className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200"
                        >
                          {source.label}
                        </a>
                      ) : (
                        <span
                          key={source.id}
                          title={source.title}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-black/40 dark:text-slate-400"
                        >
                          {source.label}
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
