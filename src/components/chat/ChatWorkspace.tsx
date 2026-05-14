import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Bot, Database, Globe2, Plus, Send, Square, Trash2 } from 'lucide-react'
import { cn, parseThinking, useRefreshSettings } from '@/lib/utils'
import { resolveChatProviderId, resolveLatestChatProvider } from '@/lib/chat/provider-resolution'
import { resolveImmediateChatConnectionStatus } from '@/lib/chat/provider-status'
import { buildAgentTimelineMessage } from '@/lib/agent/agent-timeline-writeback'
import { canSwitchAgentMode, type ChatSurfaceMode } from '@/lib/chat/agent-mode'
import {
  getSessionTabClass,
  getStageShellClass,
  getStageStatusClusterClass,
  getStageToolbarClass,
  getStageWorkspaceBackdropClass,
} from './stage-shell-styles'
import {
  getComposerActionButtonClass,
  getComposerRowClass,
  getComposerShellClass,
  getComposerTextareaClass,
} from './composer-surface-styles'
import { AgentApprovalBanner } from './AgentApprovalBanner'
import { ChatSessionTimeline } from './ChatSessionTimeline'
import { buildMessageSources, buildWebMessageSources, resolveChatSendMode } from '@/lib/chat/chat-send-mode'
import { scrollSurfaceTimelineToBottom } from '@/lib/chat/surface-timeline'
import { AgentComposer } from '@/components/workspace/agent/AgentComposer'
import { AgentContextRail } from '@/components/workspace/agent/AgentContextRail'
import { useAgentStore, useChatStore, useMCPStore, useSettingsStore } from '@/lib/store'
import { getProviderValidationError, type Message } from '@/lib/providers'
import type { AgentExecutionMode, AgentTaskEvent, AgentTaskStatus } from '@/types/agent'

const GREETING_MESSAGE = '你好！我是 AI Box 助手。有什么我可以帮助你的吗？'
const GENERATION_STOPPED_MESSAGE = '已停止生成。'

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function createAgentEventMessageId(event: AgentTaskEvent): string {
  return `agent-${event.taskId}-${event.type}-${event.timestamp}`
}

export function ChatWorkspace() {
  useRefreshSettings()

  const {
    sessions,
    activeSessionId,
    isGenerating,
    createSession,
    deleteSession,
    setActiveSession,
    addMessage,
    updateMessage,
    updateMessageState,
    updateThinking,
    setThinkingExpanded,
    toggleThinkingExpanded,
    setGenerating,
  } = useChatStore()
  const currentTaskId = useAgentStore((state) => state.currentTaskId)
  const agentStatus = useAgentStore((state) => state.status)
  const plan = useAgentStore((state) => state.plan)
  const selectedSkills = useAgentStore((state) => state.selectedSkills)
  const logs = useAgentStore((state) => state.logs)
  const approval = useAgentStore((state) => state.approval)
  const applyAgentEvent = useAgentStore((state) => state.applyEvent)
  const resetAgent = useAgentStore((state) => state.reset)

  const { activeProviders, providers, decryptApiKeys } = useSettingsStore()
  const serverConfigs = useMCPStore((state) => state.serverConfigs)

  const [input, setInput] = useState('')
  const [agentPrompt, setAgentPrompt] = useState('')
  const [surfaceMode, setSurfaceMode] = useState<ChatSurfaceMode>('chat')
  const [agentExecutionMode, setAgentExecutionMode] = useState<AgentExecutionMode>('auto')
  const [isAgentStarting, setIsAgentStarting] = useState(false)
  const [normalChatMode, setNormalChatMode] = useState<'chat' | 'rag' | 'web'>('chat')
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown')
  const chatTimelineContainerRef = useRef<HTMLDivElement>(null)
  const agentTimelineContainerRef = useRef<HTMLDivElement>(null)
  const initRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const pendingAgentSessionIdRef = useRef<string | null>(null)
  const activeAgentSessionIdRef = useRef<string | null>(null)
  const activeAgentTaskIdRef = useRef<string | null>(null)

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [sessions, activeSessionId]
  )
  const connectedServerCount = useMemo(
    () => serverConfigs.filter((server) => server.connected).length,
    [serverConfigs]
  )
  const chatProviderId = resolveChatProviderId(activeProviders.text)
  const providerConfig = useMemo(
    () => providers.find((provider) => provider.id === chatProviderId),
    [providers, chatProviderId]
  )
  const providerName = providerConfig?.name || chatProviderId
  const isNormalModeToggleDisabled = surfaceMode === 'agent'
  const isAgentBusy = isAgentStarting || agentStatus === 'running' || agentStatus === 'awaiting-approval'
  const isConversationLocked = isGenerating || isAgentBusy

  const scrollToBottom = useCallback(() => {
    scrollSurfaceTimelineToBottom({
      surfaceMode,
      chatTimelineContainerRef,
      agentTimelineContainerRef,
    })
  }, [surfaceMode])

  useEffect(() => {
    scrollToBottom()
  }, [activeSession?.messages, scrollToBottom])

  useEffect(() => {
    if (!initRef.current && sessions.length === 0) {
      initRef.current = true
      createSession()
    }
  }, [createSession, sessions.length])

  useEffect(() => {
    setSurfaceMode('chat')
  }, [])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const resolveEventSessionId = useCallback((event: AgentTaskEvent): string | null => {
    if (event.type === 'task.created' && pendingAgentSessionIdRef.current) {
      activeAgentTaskIdRef.current = event.taskId
      activeAgentSessionIdRef.current = pendingAgentSessionIdRef.current
      pendingAgentSessionIdRef.current = null
    }

    if (event.taskId === activeAgentTaskIdRef.current) {
      return activeAgentSessionIdRef.current
    }

    return null
  }, [])

  useEffect(() => {
    return window.electronAPI.agent.onTaskEvent((event) => {
      applyAgentEvent(event)

      const sessionId = resolveEventSessionId(event)
      const timelineMessage = buildAgentTimelineMessage(event)
      if (sessionId && timelineMessage) {
        addMessage(sessionId, {
          id: createAgentEventMessageId(event),
          timestamp: event.timestamp,
          ...timelineMessage,
        })
      }

      if (
        event.type === 'task.completed' ||
        event.type === 'task.failed' ||
        event.type === 'task.rejected'
      ) {
        pendingAgentSessionIdRef.current = null
        activeAgentSessionIdRef.current = null
        activeAgentTaskIdRef.current = null
      }
    })
  }, [addMessage, applyAgentEvent, resolveEventSessionId])

  const appendAssistantMessage = useCallback(
    (sessionId: string, content: string, overrides: Partial<Message> = {}) => {
      addMessage(sessionId, {
        id: createMessageId(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
        origin: 'chat',
        tone: 'default',
        ...overrides,
      })
    },
    [addMessage]
  )

  const prepareRunnableProviderConfig = useCallback(async () => {
    await decryptApiKeys()
    const latestSettings = useSettingsStore.getState()
    const latestProvider = resolveLatestChatProvider({
      activeProvider: latestSettings.activeProviders.text,
      providers: latestSettings.providers,
      persistedSettings: window.localStorage.getItem('ai-box-settings'),
    })
    const currentProviderConfig =
      latestProvider.providerConfig ?? latestSettings.getProviderConfig(latestProvider.providerId)

    if (!currentProviderConfig) {
      return {
        errorMessage: `错误: 当前激活的 Provider "${latestProvider.providerId}" 不存在，请检查设置。`,
      }
    }

    const decryptedApiKey = latestSettings.getDecryptedApiKey(latestProvider.providerId)
    const runnableProviderConfig = {
      ...currentProviderConfig,
      apiKey:
        decryptedApiKey ||
        (typeof currentProviderConfig.apiKey === 'string' ? currentProviderConfig.apiKey : ''),
    }

    const validationError = getProviderValidationError(runnableProviderConfig)
    if (validationError) {
      return {
        errorMessage: `错误: ${validationError}`,
      }
    }

    return {
      latestSettings,
      runnableProviderConfig,
    }
  }, [decryptApiKeys])

  const handleSend = async () => {
    if (!input.trim() || isGenerating || isAgentBusy || !activeSession) {
      return
    }

    const preparedProvider = await prepareRunnableProviderConfig()
    if ('errorMessage' in preparedProvider) {
      appendAssistantMessage(activeSession.id, preparedProvider.errorMessage, {
        tone: 'error',
      })
      return
    }

    const userMessage: Message = {
      id: createMessageId(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
      origin: 'chat',
    }

    addMessage(activeSession.id, userMessage)
    setInput('')

    const conversationMessages = [...activeSession.messages, userMessage].filter((message) => {
      return !(message.role === 'assistant' && message.content === GREETING_MESSAGE)
    })

    const sendMode = resolveChatSendMode({
      isAgentMode: false,
      isRagEnabled: normalChatMode === 'rag',
      isWebSearchEnabled: normalChatMode === 'web',
    })

    if (sendMode === 'rag') {
      const assistantMessageId = createMessageId()
      addMessage(activeSession.id, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        origin: 'rag',
      })
      setGenerating(true)

      try {
        const lmstudioProvider = preparedProvider.latestSettings.providers.find(
          (provider) => provider.id === 'lmstudio'
        )
        const result = await window.electronAPI.rag.query({
          providerConfig: preparedProvider.runnableProviderConfig,
          embeddingModel: lmstudioProvider?.embeddingModel || 'nomic-embed-text-v1.5',
          messages: conversationMessages,
          question: userMessage.content,
          limit: 5,
        })

        updateMessage(activeSession.id, assistantMessageId, result.answer)
        updateMessageState(activeSession.id, assistantMessageId, {
          origin: 'rag',
          sources: buildMessageSources(result.matches),
        })
      } catch (error) {
        updateMessage(
          activeSession.id,
          assistantMessageId,
          `错误: ${error instanceof Error ? error.message : '知识库问答失败'}`
        )
      } finally {
        setGenerating(false)
      }

      return
    }

    if (sendMode === 'web') {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      const assistantMessageId = createMessageId()
      addMessage(activeSession.id, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        origin: 'web',
      })
      setGenerating(true)

      let fullContent = ''
      let fullThinking = ''
      let hasReasoningContent = false
      let hasThinking = false

      try {
        await preparedProvider.latestSettings.decryptWebSearchApiKey()
        const latestSettings = useSettingsStore.getState()
        const webSearchConfig = latestSettings.getRunnableWebSearchConfig()
        const result = await window.electronAPI.webSearch.query({
          searchConfig: webSearchConfig,
          providerConfig: preparedProvider.runnableProviderConfig,
          messages: conversationMessages,
          question: userMessage.content,
        })

        if (abortController.signal.aborted || requestIdRef.current !== requestId) {
          if (!fullContent.trim()) {
            updateMessage(activeSession.id, assistantMessageId, GENERATION_STOPPED_MESSAGE)
          }
          return
        }

        const unsubscribeChunks = window.electronAPI.chat.onChunk(({ requestId: chunkRequestId, chunk }) => {
          if (
            chunkRequestId !== requestId ||
            abortController.signal.aborted ||
            requestIdRef.current !== requestId ||
            chunk.done
          ) {
            return
          }

          if (chunk.reasoning_content) {
            hasReasoningContent = true
            hasThinking = true
            fullThinking += chunk.reasoning_content
            updateThinking(activeSession.id, assistantMessageId, fullThinking)
            setThinkingExpanded(activeSession.id, assistantMessageId, true)
          }

          if (chunk.content) {
            fullContent += chunk.content
            updateMessage(activeSession.id, assistantMessageId, fullContent)
          }

          if (!hasReasoningContent && chunk.content) {
            const { thinking, response } = parseThinking(fullContent)
            if (thinking !== null) {
              hasThinking = true
              updateThinking(activeSession.id, assistantMessageId, thinking)
              updateMessage(activeSession.id, assistantMessageId, response)
              setThinkingExpanded(activeSession.id, assistantMessageId, true)
            }
          }
        })

        try {
          await window.electronAPI.chat.complete({
            requestId,
            providerConfig: preparedProvider.runnableProviderConfig,
            messages: result.answerMessages,
          })
        } finally {
          unsubscribeChunks()
        }

        if (!abortController.signal.aborted && requestIdRef.current === requestId && !hasReasoningContent) {
          const { thinking, response } = parseThinking(fullContent)
          if (thinking !== null) {
            hasThinking = true
            updateThinking(activeSession.id, assistantMessageId, thinking)
            updateMessage(activeSession.id, assistantMessageId, response)
          }
        }

        updateMessageState(activeSession.id, assistantMessageId, {
          origin: 'web',
          sources: buildWebMessageSources(result.results),
        })
      } catch (error) {
        if (abortController.signal.aborted || isAbortError(error)) {
          if (!fullContent.trim()) {
            updateMessage(activeSession.id, assistantMessageId, GENERATION_STOPPED_MESSAGE)
          }
          return
        }

        updateMessage(
          activeSession.id,
          assistantMessageId,
          `错误: ${error instanceof Error ? error.message : '联网搜索失败'}`
        )
        updateMessageState(activeSession.id, assistantMessageId, {
          origin: 'web',
          tone: 'error',
        })
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null
        }

        if (requestIdRef.current === requestId) {
          setGenerating(false)
          if (hasThinking) {
            setThinkingExpanded(activeSession.id, assistantMessageId, false)
          }
        }
      }

      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setGenerating(true)

    const assistantMessageId = createMessageId()
    addMessage(activeSession.id, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      origin: 'chat',
    })

    let fullContent = ''
    let fullThinking = ''
    let hasReasoningContent = false
    let hasThinking = false

    try {
      const unsubscribeChunks = window.electronAPI.chat.onChunk(({ requestId: chunkRequestId, chunk }) => {
        if (
          chunkRequestId !== requestId ||
          abortController.signal.aborted ||
          requestIdRef.current !== requestId ||
          chunk.done
        ) {
          return
        }

        if (chunk.reasoning_content) {
          hasReasoningContent = true
          hasThinking = true
          fullThinking += chunk.reasoning_content
          updateThinking(activeSession.id, assistantMessageId, fullThinking)
          setThinkingExpanded(activeSession.id, assistantMessageId, true)
        }

        if (chunk.content) {
          fullContent += chunk.content
          updateMessage(activeSession.id, assistantMessageId, fullContent)
        }

        if (!hasReasoningContent && chunk.content) {
          const { thinking, response } = parseThinking(fullContent)
          if (thinking !== null) {
            hasThinking = true
            updateThinking(activeSession.id, assistantMessageId, thinking)
            updateMessage(activeSession.id, assistantMessageId, response)
            setThinkingExpanded(activeSession.id, assistantMessageId, true)
          }
        }
      })

      try {
        await window.electronAPI.chat.complete({
          requestId,
          providerConfig: preparedProvider.runnableProviderConfig,
          messages: conversationMessages,
        })
      } finally {
        unsubscribeChunks()
      }

      if (!abortController.signal.aborted && requestIdRef.current === requestId && !hasReasoningContent) {
        const { thinking, response } = parseThinking(fullContent)
        if (thinking !== null) {
          hasThinking = true
          updateThinking(activeSession.id, assistantMessageId, thinking)
          updateMessage(activeSession.id, assistantMessageId, response)
        }
      }
    } catch (error) {
      if (abortController.signal.aborted || isAbortError(error)) {
        if (!fullContent.trim()) {
          updateMessage(activeSession.id, assistantMessageId, GENERATION_STOPPED_MESSAGE)
        }
        return
      }

      updateMessage(
        activeSession.id,
        assistantMessageId,
        `错误: ${error instanceof Error ? error.message : '未知错误'}`
      )
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null
      }

      if (requestIdRef.current === requestId) {
        setGenerating(false)
        if (hasThinking) {
          setThinkingExpanded(activeSession.id, assistantMessageId, false)
        }
      }
    }
  }

  const handleAgentStart = async () => {
    if (!agentPrompt.trim() || isGenerating || isAgentBusy || !activeSession) {
      return
    }

    const preparedProvider = await prepareRunnableProviderConfig()
    if ('errorMessage' in preparedProvider) {
      appendAssistantMessage(activeSession.id, preparedProvider.errorMessage, {
        origin: 'agent',
        tone: 'error',
      })
      return
    }

    const userMessage: Message = {
      id: createMessageId(),
      role: 'user',
      content: agentPrompt.trim(),
      timestamp: Date.now(),
      origin: 'agent',
    }

    addMessage(activeSession.id, userMessage)
    setAgentPrompt('')
    resetAgent()
    pendingAgentSessionIdRef.current = activeSession.id
    setIsAgentStarting(true)

    try {
      const conversationHistory = [...activeSession.messages, userMessage].filter((message) => {
        return !(message.role === 'assistant' && message.content === GREETING_MESSAGE)
      })

      await window.electronAPI.agent.startTask({
        prompt: userMessage.content,
        mode: agentExecutionMode,
        provider: preparedProvider.runnableProviderConfig,
        mcpServers: serverConfigs,
        conversationHistory,
      })
    } catch (error) {
      pendingAgentSessionIdRef.current = null
      activeAgentSessionIdRef.current = null
      activeAgentTaskIdRef.current = null
      appendAssistantMessage(
        activeSession.id,
        `错误: ${error instanceof Error ? error.message : 'Agent 任务启动失败'}`,
        {
          origin: 'agent',
          tone: 'error',
        }
      )
    } finally {
      pendingAgentSessionIdRef.current = null
      setIsAgentStarting(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  const testConnection = useCallback(async () => {
    const latestSettings = useSettingsStore.getState()
    const latestProviderId = resolveChatProviderId(latestSettings.activeProviders.text)
    const latestProviderConfig = latestSettings.providers.find((provider) => provider.id === latestProviderId)

    const immediateStatus = resolveImmediateChatConnectionStatus(latestProviderConfig)
    if (immediateStatus) {
      setConnectionStatus(immediateStatus)
      return
    }

    if (!latestProviderConfig) {
      setConnectionStatus('unknown')
      return
    }

    const decryptedApiKey = latestSettings.getDecryptedApiKey(latestProviderId)
    const runnableProviderConfig = {
      ...latestProviderConfig,
      apiKey:
        decryptedApiKey ||
        (typeof latestProviderConfig.apiKey === 'string' ? latestProviderConfig.apiKey : ''),
    }

    if (getProviderValidationError(runnableProviderConfig)) {
      setConnectionStatus('disconnected')
      return
    }

    setConnectionStatus('unknown')
    try {
      const headers: Record<string, string> = {}
      if (runnableProviderConfig.apiKey) {
        headers.Authorization = `Bearer ${runnableProviderConfig.apiKey}`
      }
      const response = await fetch(`${runnableProviderConfig.baseURL}/models`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(3000),
      })
      setConnectionStatus(response.ok ? 'connected' : 'disconnected')
    } catch {
      setConnectionStatus('disconnected')
    }
  }, [])

  useEffect(() => {
    void testConnection()
  }, [testConnection])

  const stopGeneration = () => {
    abortControllerRef.current?.abort()
    void window.electronAPI.chat.abort(requestIdRef.current)
    abortControllerRef.current = null
    setGenerating(false)
  }

  const handleAgentCancel = async () => {
    if (!currentTaskId) {
      return
    }

    await window.electronAPI.agent.cancelTask(currentTaskId)
  }

  const handleApproveAgentAction = async (actionId: string) => {
    if (!currentTaskId) {
      return
    }

    await window.electronAPI.agent.approveAction(currentTaskId, actionId)
  }

  const handleRejectAgentAction = async (actionId: string) => {
    if (!currentTaskId) {
      return
    }

    await window.electronAPI.agent.rejectAction(currentTaskId, actionId)
  }

  const clearIdleAgentContext = useCallback(() => {
    if (isAgentBusy) {
      return
    }

    resetAgent()
    pendingAgentSessionIdRef.current = null
    activeAgentSessionIdRef.current = null
    activeAgentTaskIdRef.current = null
  }, [isAgentBusy, resetAgent])

  const handleNewChat = () => {
    if (isConversationLocked) {
      return
    }

    clearIdleAgentContext()
    createSession()
  }

  const handleDeleteChat = (event: React.MouseEvent, sessionId: string) => {
    event.stopPropagation()
    if (isConversationLocked) {
      return
    }

    if (sessionId === activeSessionId) {
      clearIdleAgentContext()
    }

    deleteSession(sessionId)
  }

  const handleToggleThinking = (messageId: string) => {
    if (activeSession) {
      toggleThinkingExpanded(activeSession.id, messageId)
    }
  }

  const handleSurfaceModeChange = (nextMode: ChatSurfaceMode) => {
    if (
      !canSwitchAgentMode({
        currentMode: surfaceMode,
        nextMode,
        isChatGenerating: isGenerating,
        agentStatus,
      })
    ) {
      return
    }

    setSurfaceMode(nextMode)
  }

  const connectionLabel =
    connectionStatus === 'connected'
      ? '已连接'
      : connectionStatus === 'disconnected'
        ? '未连接'
        : '检测中'

  const statusDotClassName =
    connectionStatus === 'connected'
      ? 'bg-green-500 shadow-sm shadow-green-500/50'
      : connectionStatus === 'disconnected'
      ? 'bg-red-500 shadow-sm shadow-red-500/50'
        : 'bg-gray-500'
  const canOpenAgentMode = canSwitchAgentMode({
    currentMode: surfaceMode,
    nextMode: 'agent',
    isChatGenerating: isGenerating,
    agentStatus,
  })
  const isWebSearchMode = normalChatMode === 'web'
  const canReturnToChat = canSwitchAgentMode({
    currentMode: surfaceMode,
    nextMode: 'chat',
    isChatGenerating: isGenerating,
    agentStatus,
  })
  const agentStatusLabel = getAgentStatusLabel(agentStatus)
  const normalModeItems = [
    { id: 'chat', label: '普通', icon: null },
    { id: 'rag', label: '知识库', icon: Database },
    { id: 'web', label: '联网', icon: Globe2 },
  ] as const

  const renderNormalModeSelector = () => (
    <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-black">
      {normalModeItems.map((item) => {
        const Icon = item.icon
        const active = normalChatMode === item.id

        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            disabled={isNormalModeToggleDisabled}
            onClick={() => setNormalChatMode(item.id as 'chat' | 'rag' | 'web')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition disabled:cursor-not-allowed disabled:opacity-60',
              active
                ? 'bg-[#4a9eff] text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100'
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            <span>{item.label}</span>
          </button>
        )
      })}
    </div>
  )

  return (
    <div className={getStageWorkspaceBackdropClass()}>
      <div className={getStageShellClass()}>
        <div className={getStageToolbarClass()}>
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
            {sessions.slice(0, 8).map((session) => (
              <button
                key={session.id}
                onClick={() => {
                  if (!isConversationLocked) {
                    clearIdleAgentContext()
                    setActiveSession(session.id)
                  }
                }}
                disabled={isConversationLocked}
                className={cn(
                  getSessionTabClass(activeSessionId === session.id),
                  'group min-w-fit cursor-pointer disabled:cursor-not-allowed disabled:opacity-60'
                )}
              >
                <span className="max-w-[88px] truncate">{session.title}</span>
                {sessions.length > 1 && (
                  <span
                    onClick={(event) => handleDeleteChat(event, session.id)}
                    className="rounded-full p-0.5 opacity-0 transition-opacity hover:bg-slate-200/80 group-hover:opacity-100 dark:hover:bg-black"
                  >
                    <Trash2 size={10} />
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={handleNewChat}
              disabled={isConversationLocked}
              className={cn(getSessionTabClass(false), 'min-w-fit')}
              aria-label="新建对话"
            >
              <Plus size={12} />
            </button>
          </div>

          <div className={getStageStatusClusterClass()}>
            {renderNormalModeSelector()}
            <div className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
            <span>
              Provider:
              <span className="ml-1 font-medium text-[#4a9eff]">
                {providerConfig?.name || chatProviderId}
              </span>
            </span>
            <div className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
            <span>
              Model:
              <span className="ml-1 font-medium text-slate-900 dark:text-slate-50">
                {providerConfig?.model || '未设置'}
              </span>
            </span>
            <div className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <div className={cn('h-2 w-2 rounded-full', statusDotClassName)} />
              <span>{connectionLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden">
            <div
              className={cn(
                'flex h-full w-[200%] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
                surfaceMode === 'agent' ? '-translate-x-1/2' : 'translate-x-0'
              )}
            >
              <section className="flex min-h-0 w-1/2 flex-col">
                <div className="border-b border-slate-200/70 bg-white/70 px-5 py-4 dark:border-slate-700/70 dark:bg-black">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                        普通聊天
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        可选择普通、知识库或联网搜索回答；切换到 Agent 后共用当前对话上下文。
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {renderNormalModeSelector()}

                      <button
                        type="button"
                        aria-pressed={surfaceMode === 'agent'}
                        onClick={() => handleSurfaceModeChange('agent')}
                        disabled={!canOpenAgentMode}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-60',
                          surfaceMode === 'agent'
                            ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200'
                            : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-black dark:text-slate-300'
                        )}
                      >
                        <Bot className="h-3.5 w-3.5" />
                        <span>Agent 模式</span>
                      </button>
                    </div>
                  </div>

                  <div className={cn(getStageStatusClusterClass(), 'mt-3')}>
                    <span>
                      Provider:
                      <span className="ml-1 font-medium text-[#4a9eff]">{providerName}</span>
                    </span>
                    <div className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
                    <span>
                      Model:
                      <span className="ml-1 font-medium text-slate-900 dark:text-slate-50">
                        {providerConfig?.model || '未设置'}
                      </span>
                    </span>
                    <div className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
                    <div className="flex items-center gap-1.5">
                      <div className={cn('h-2 w-2 rounded-full', statusDotClassName)} />
                      <span>{connectionLabel}</span>
                    </div>
                  </div>
                </div>

                <div ref={chatTimelineContainerRef} className="flex-1 overflow-y-auto px-5 py-5">
                  <ChatSessionTimeline
                    messages={activeSession?.messages ?? []}
                    isGenerating={isGenerating}
                    onToggleThinking={handleToggleThinking}
                  />
                </div>

                <div className={getComposerShellClass()}>
                  <div className={getComposerRowClass()}>
                    <button
                      type="button"
                      aria-pressed={isWebSearchMode}
                      disabled={isNormalModeToggleDisabled}
                      onClick={() => setNormalChatMode(normalChatMode === 'web' ? 'chat' : 'web')}
                      title={normalChatMode === 'web' ? '关闭联网搜索' : '打开联网搜索'}
                      className={cn(
                        'flex h-11 shrink-0 items-center gap-2 rounded-[18px] border px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-60',
                        isWebSearchMode
                          ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-sm shadow-sky-100 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200 dark:shadow-none'
                          : 'border-slate-200/80 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-700/80 dark:bg-black dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100'
                      )}
                    >
                      <Globe2 className="h-4 w-4" />
                      <span>联网</span>
                    </button>
                    <textarea
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="输入消息... (Shift+Enter 换行)"
                      className={getComposerTextareaClass()}
                      rows={1}
                      disabled={isConversationLocked}
                    />
                    {input.length > 0 && (
                      <div className="absolute bottom-2 right-16 text-xs text-slate-400 dark:text-[#475569]">
                        {input.length}
                      </div>
                    )}
                    {isGenerating ? (
                      <button
                        onClick={stopGeneration}
                        className={getComposerActionButtonClass('stop', false)}
                        title="停止生成"
                      >
                        <Square size={18} />
                      </button>
                    ) : (
                      <button
                        onClick={() => void handleSend()}
                        disabled={!input.trim() || isConversationLocked}
                        className={getComposerActionButtonClass(
                          'send',
                          !input.trim() || isConversationLocked
                        )}
                        title="发送"
                      >
                        <Send size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <section className="flex min-h-0 w-1/2 flex-col">
                <div className="border-b border-slate-200/70 bg-white/70 px-5 py-4 dark:border-slate-700/70 dark:bg-black">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                        <Bot className="h-4 w-4 text-[#4a9eff]" />
                        <span>Agent 模式</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        共享当前消息时间线，并在右侧展示计划、Skill 与执行日志。
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={getAgentStatusClass(agentStatus)}>{agentStatusLabel}</span>
                      <button
                        type="button"
                        onClick={() => handleSurfaceModeChange('chat')}
                        disabled={!canReturnToChat}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-black dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
                      >
                        返回聊天
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="flex min-h-0 flex-col">
                    <div ref={agentTimelineContainerRef} className="flex-1 overflow-y-auto px-5 py-5">
                      <ChatSessionTimeline
                        messages={activeSession?.messages ?? []}
                        isGenerating={false}
                        onToggleThinking={handleToggleThinking}
                      />
                      {approval ? (
                        <AgentApprovalBanner
                          approval={approval}
                          onApprove={handleApproveAgentAction}
                          onReject={handleRejectAgentAction}
                        />
                      ) : null}
                    </div>

                    <AgentComposer
                      value={agentPrompt}
                      mode={agentExecutionMode}
                      providerName={providerName}
                      connectedServerCount={connectedServerCount}
                      isBusy={isAgentBusy}
                      onChange={setAgentPrompt}
                      onModeChange={setAgentExecutionMode}
                      onSubmit={() => void handleAgentStart()}
                      onCancel={() => void handleAgentCancel()}
                    />
                  </div>

                  <AgentContextRail
                    status={agentStatus}
                    mode={agentExecutionMode}
                    providerName={providerName}
                    connectedServerCount={connectedServerCount}
                    plan={plan}
                    selectedSkills={selectedSkills}
                    logs={logs}
                    onModeChange={setAgentExecutionMode}
                  />
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getAgentStatusLabel(status: AgentTaskStatus | 'idle'): string {
  if (status === 'running') {
    return '执行中'
  }

  if (status === 'awaiting-approval') {
    return '等待确认'
  }

  if (status === 'completed') {
    return '已完成'
  }

  if (status === 'failed') {
    return '失败'
  }

  if (status === 'rejected') {
    return '已拒绝'
  }

  return '空闲'
}

function getAgentStatusClass(status: AgentTaskStatus | 'idle'): string {
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
