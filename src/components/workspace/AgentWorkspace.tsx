import { useEffect, useMemo, useState } from 'react'
import { Bot, MessageSquareText } from 'lucide-react'
import { useAgentStore, useMCPStore, useSettingsStore } from '@/lib/store'
import { getStageWorkspaceBackdropClass } from '@/components/chat/stage-shell-styles'
import { AgentChatTimeline } from './agent/AgentChatTimeline'
import { AgentComposer } from './agent/AgentComposer'
import { AgentContextRail } from './agent/AgentContextRail'
import { buildAgentConversationItems } from './agent/agent-conversation'

export function AgentWorkspace() {
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<'auto' | 'confirm-external'>('auto')
  const [isStarting, setIsStarting] = useState(false)
  const currentTaskId = useAgentStore((state) => state.currentTaskId)
  const status = useAgentStore((state) => state.status)
  const events = useAgentStore((state) => state.events)
  const plan = useAgentStore((state) => state.plan)
  const selectedSkills = useAgentStore((state) => state.selectedSkills)
  const logs = useAgentStore((state) => state.logs)
  const approval = useAgentStore((state) => state.approval)
  const applyEvent = useAgentStore((state) => state.applyEvent)
  const reset = useAgentStore((state) => state.reset)
  const activeProvider = useSettingsStore((state) => state.activeProviders.text)
  const getProviderConfig = useSettingsStore((state) => state.getProviderConfig)
  const serverConfigs = useMCPStore((state) => state.serverConfigs)

  useEffect(() => {
    return window.electronAPI.agent.onTaskEvent((event) => {
      applyEvent(event)
    })
  }, [applyEvent])

  const provider = getProviderConfig(activeProvider)
  const connectedServerCount = useMemo(
    () => serverConfigs.filter((server) => server.connected).length,
    [serverConfigs]
  )
  const conversationItems = useMemo(
    () => buildAgentConversationItems({ events, approval }),
    [approval, events]
  )

  const isBusy = isStarting || status === 'running' || status === 'awaiting-approval'
  const providerName = provider?.name ?? '未配置 Provider'

  const handleStart = async () => {
    const taskPrompt = prompt.trim()
    if (!provider || !taskPrompt || isBusy) {
      return
    }

    reset()
    setPrompt('')
    setIsStarting(true)
    try {
      await window.electronAPI.agent.startTask({
        prompt: taskPrompt,
        mode,
        provider,
        mcpServers: serverConfigs,
      })
    } finally {
      setIsStarting(false)
    }
  }

  const handleCancel = async () => {
    if (!currentTaskId) {
      return
    }

    await window.electronAPI.agent.cancelTask(currentTaskId)
  }

  const handleApprove = async (actionId: string) => {
    if (!currentTaskId) {
      return
    }

    await window.electronAPI.agent.approveAction(currentTaskId, actionId)
  }

  const handleReject = async (actionId: string) => {
    if (!currentTaskId) {
      return
    }

    await window.electronAPI.agent.rejectAction(currentTaskId, actionId)
  }

  return (
    <div className={getStageWorkspaceBackdropClass()}>
      <div className="mx-auto flex h-full w-full max-w-7xl min-h-0 flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white/70 shadow-[0_30px_90px_rgba(148,163,184,0.22)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-black dark:shadow-[0_34px_96px_rgba(2,6,23,0.46)]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/75 bg-white/70 px-4 py-3 backdrop-blur-md dark:border-slate-700/70 dark:bg-black">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4a9eff] to-[#2563eb] text-white shadow-lg shadow-blue-500/20">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                <MessageSquareText className="h-4 w-4 text-[#4a9eff]" />
                Agent Chat
              </div>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                对话中自然展开计划、Skill、MCP 调用和脚本日志
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 rounded-full border border-white/80 bg-white/75 px-4 py-1.5 text-xs text-slate-500 shadow-sm dark:border-slate-700/70 dark:bg-black dark:text-slate-400 md:flex">
            <span>
              Provider:
              <span className="ml-1 font-medium text-[#4a9eff]">{providerName}</span>
            </span>
            <span className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
            <span>
              MCP:
              <span className="ml-1 font-medium text-slate-900 dark:text-slate-50">
                {connectedServerCount}
              </span>
            </span>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-h-0 flex-col">
            <AgentChatTimeline
              items={conversationItems}
              status={status}
              activeTaskId={currentTaskId}
              onApprove={handleApprove}
              onReject={handleReject}
            />
            <AgentComposer
              value={prompt}
              mode={mode}
              providerName={providerName}
              connectedServerCount={connectedServerCount}
              isBusy={isBusy}
              onChange={setPrompt}
              onModeChange={setMode}
              onSubmit={handleStart}
              onCancel={handleCancel}
            />
          </div>

          <AgentContextRail
            status={status}
            mode={mode}
            providerName={providerName}
            connectedServerCount={connectedServerCount}
            plan={plan}
            selectedSkills={selectedSkills}
            logs={logs}
            onModeChange={setMode}
          />
        </div>
      </div>
    </div>
  )
}
