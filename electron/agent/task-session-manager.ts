import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type {
  AgentApprovalRequest,
  AgentObservation,
  AgentPlanItem,
  AgentPlanningState,
  AgentPendingAction,
  AgentStartTaskRequest,
  AgentTaskEvent,
  AgentTaskSession,
} from '../../src/types/agent.ts'

export type CreateTaskSessionInput = AgentStartTaskRequest

const LOOP_RESULT_COMPACTION_THRESHOLD = 1000
const LOOP_RESULT_COMPACTION_PREVIEW = 700
const DEFAULT_MAX_SESSIONS = 50
const DEFAULT_CLEANUP_AGE_MS = 60 * 60 * 1000 // 1 hour
const DEFAULT_SESSIONS_ROOT = join(homedir(), '.agents', 'sessions')

export interface TaskSessionManagerOptions {
  maxSessions?: number
  cleanupAgeMs?: number
  sessionsRoot?: string
}

export class TaskSessionManager {
  private sessions = new Map<string, AgentTaskSession>()
  private maxSessions: number
  private cleanupAgeMs: number
  private sessionsRoot: string

  constructor(options: TaskSessionManagerOptions = {}) {
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS
    this.cleanupAgeMs = options.cleanupAgeMs ?? DEFAULT_CLEANUP_AGE_MS
    this.sessionsRoot = options.sessionsRoot ?? DEFAULT_SESSIONS_ROOT
    this.loadSessions()
  }

  create(input: CreateTaskSessionInput): AgentTaskSession {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const timestamp = Date.now()
    const initialLoopMessages = this.toInitialLoopMessages(input, timestamp)
    const session: AgentTaskSession = {
      id,
      prompt: input.prompt,
      mode: input.mode,
      provider: input.provider,
      mcpServers: input.mcpServers,
      status: 'running',
      events: [
        {
          type: 'task.created',
          taskId: id,
          timestamp,
          payload: { prompt: input.prompt, mode: input.mode },
        },
      ],
      observations: [],
      planning: {
        items: [],
        roundsSinceUpdate: 0,
      },
      loop: {
        messages: initialLoopMessages,
        turnCount: 1,
        transitionReason: null,
        compactionCount: 0,
      },
      approval: {
        state: 'idle',
        request: null,
      },
      pendingAction: null,
    }

    this.sessions.set(id, session)
    this.maybeCleanup()
    return session
  }

  get(taskId: string): AgentTaskSession | undefined {
    return this.sessions.get(taskId)
  }

  appendEvent(taskId: string, event: AgentTaskEvent): void {
    const session = this.require(taskId)
    session.events.push(event)
  }

  addObservation(taskId: string, observation: AgentObservation): void {
    const session = this.require(taskId)
    session.observations.push(observation)
  }

  updatePlanning(taskId: string, items: AgentPlanItem[]): AgentPlanningState {
    const session = this.require(taskId)
    const normalized = items.map((item) => ({
      content: this.requireNonEmptyString(item.content, 'content'),
      status: this.normalizePlanStatus(item.status),
      ...(item.activeForm && item.activeForm.trim()
        ? { activeForm: item.activeForm.trim() }
        : {}),
    }))
    const activeCount = normalized.filter((item) => item.status === 'in_progress').length
    if (activeCount > 1) {
      throw new Error('Agent planning can contain at most one in_progress item')
    }

    session.planning = {
      items: normalized,
      roundsSinceUpdate: 0,
    }

    return session.planning
  }

  incrementPlanningStaleness(taskId: string): AgentPlanningState {
    const session = this.require(taskId)
    session.planning = {
      ...session.planning,
      roundsSinceUpdate: session.planning.roundsSinceUpdate + 1,
    }

    return session.planning
  }

  recordAssistantDecision(taskId: string, decision: Record<string, unknown>): void {
    const session = this.require(taskId)
    session.loop.messages.push({
      role: 'assistant',
      content: decision,
      timestamp: Date.now(),
    })
    session.loop.transitionReason = null
  }

  recordObservationWriteBack(taskId: string, observation: AgentObservation): void {
    const session = this.require(taskId)
    const content = this.toLoopResultContent(session, observation.rawExcerpt)
    session.loop.messages.push({
      role: 'user',
      content: [
        {
          type: observation.type,
          tool_use_id: observation.actionId,
          status: observation.status,
          name: observation.name,
          summary: observation.summary,
          content,
          artifacts: observation.artifacts,
        },
      ],
      timestamp: Date.now(),
    })
    session.loop.turnCount += 1
    session.loop.transitionReason = observation.type
  }

  recordHookMessage(taskId: string, message: string): void {
    const session = this.require(taskId)
    session.loop.messages.push({
      role: 'user',
      content: [
        {
          type: 'hook_message',
          content: message,
        },
      ],
      timestamp: Date.now(),
    })
    session.loop.turnCount += 1
    session.loop.transitionReason = null
  }

  compactLoopForRecovery(taskId: string, reason: string): void {
    const session = this.require(taskId)
    const timestamp = Date.now()
    const firstMessage = session.loop.messages[0]
    const lastMessage = session.loop.messages.at(-1)
    const compactedMessage = {
      role: 'user' as const,
      content: `[recovery compacted active loop: ${reason}]`,
      timestamp,
    }

    session.loop.messages =
      firstMessage && lastMessage && firstMessage !== lastMessage
        ? [firstMessage, compactedMessage, lastMessage]
        : firstMessage
          ? [firstMessage, compactedMessage]
          : [compactedMessage]
    session.loop.compactionCount += 1
    session.loop.transitionReason = null
  }

  compactLoopProactive(taskId: string, reason: string): void {
    const session = this.require(taskId)
    const timestamp = Date.now()
    const firstMessage = session.loop.messages[0]

    if (!firstMessage || session.loop.messages.length <= 3) {
      return
    }

    const lastMessages = session.loop.messages.slice(-2)
    const removedCount = session.loop.messages.length - 1 - lastMessages.length

    session.loop.messages = [
      firstMessage,
      {
        role: 'user' as const,
        content: `[proactive compaction: ${removedCount} messages removed, ${reason}]`,
        timestamp,
      },
      ...lastMessages,
    ]
    session.loop.compactionCount += 1
    session.loop.transitionReason = null
  }

  setAwaitingApproval(
    taskId: string,
    request: AgentApprovalRequest,
    pendingAction: AgentPendingAction
  ): void {
    const session = this.require(taskId)
    session.status = 'awaiting-approval'
    session.approval = { state: 'pending', request }
    session.pendingAction = pendingAction
  }

  approve(taskId: string): AgentPendingAction | null {
    const session = this.require(taskId)
    session.status = 'running'
    session.approval = { state: 'resolved', request: null }
    const pendingAction = session.pendingAction
    session.pendingAction = null
    return pendingAction
  }

  reject(taskId: string): void {
    const session = this.require(taskId)
    session.status = 'rejected'
    session.approval = { state: 'resolved', request: null }
    session.pendingAction = null
    this.persistSession(session)
  }

  finalize(taskId: string): void {
    const session = this.require(taskId)
    if (session.status === 'completed' || session.status === 'failed' || session.status === 'rejected') {
      this.persistSession(session)
    }
  }

  private maybeCleanup(): void {
    if (this.sessions.size <= this.maxSessions) {
      return
    }

    const now = Date.now()
    const completedStatuses = new Set(['completed', 'failed', 'rejected'])
    const candidates: Array<{ id: string; lastActivity: number }> = []

    for (const [id, session] of this.sessions) {
      if (!completedStatuses.has(session.status)) {
        continue
      }

      const lastEvent = session.events.at(-1)
      const lastLoopMessage = session.loop.messages.at(-1)
      const lastActivity = Math.max(
        lastEvent?.timestamp ?? 0,
        typeof lastLoopMessage?.timestamp === 'number' ? lastLoopMessage.timestamp : 0
      )

      if (now - lastActivity > this.cleanupAgeMs) {
        candidates.push({ id, lastActivity })
      }
    }

    candidates.sort((a, b) => a.lastActivity - b.lastActivity)
    const toRemove = this.sessions.size - this.maxSessions
    for (let i = 0; i < Math.min(toRemove, candidates.length); i++) {
      this.sessions.delete(candidates[i]!.id)
    }
  }

  private loadSessions(): void {
    if (!existsSync(this.sessionsRoot)) {
      return
    }

    const files = readdirSync(this.sessionsRoot).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      try {
        const data = JSON.parse(readFileSync(join(this.sessionsRoot, file), 'utf8')) as AgentTaskSession
        if (data.id && data.status && data.loop) {
          // Mark running/awaiting-approval sessions as failed (interrupted by restart)
          if (data.status === 'running' || data.status === 'awaiting-approval') {
            data.status = 'failed'
            data.events.push({
              type: 'task.failed',
              taskId: data.id,
              timestamp: Date.now(),
              payload: { message: 'Interrupted by app restart' },
            })
          }
          this.sessions.set(data.id, data)
        }
      } catch {
        // Skip corrupt session files
      }
    }
  }

  private persistSession(session: AgentTaskSession): void {
    mkdirSync(this.sessionsRoot, { recursive: true })
    writeFileSync(
      join(this.sessionsRoot, `${session.id}.json`),
      `${JSON.stringify(session, null, 2)}\n`,
      'utf8'
    )
  }

  private require(taskId: string): AgentTaskSession {
    const session = this.sessions.get(taskId)
    if (!session) {
      throw new Error(`Unknown task session: ${taskId}`)
    }
    return session
  }

  private normalizePlanStatus(status: unknown): AgentPlanItem['status'] {
    if (status === 'pending' || status === 'in_progress' || status === 'completed') {
      return status
    }

    throw new Error(`Unsupported planning status: ${String(status)}`)
  }

  private requireNonEmptyString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Planning item ${field} must be a non-empty string`)
    }

    return value.trim()
  }

  private toLoopResultContent(session: AgentTaskSession, content: string): string {
    if (content.length <= LOOP_RESULT_COMPACTION_THRESHOLD) {
      return content
    }

    session.loop.compactionCount += 1
    return [
      content.slice(0, LOOP_RESULT_COMPACTION_PREVIEW),
      `[content compacted: original ${content.length} chars, preview ${LOOP_RESULT_COMPACTION_PREVIEW} chars]`,
    ].join('\n')
  }

  private toInitialLoopMessages(
    input: CreateTaskSessionInput,
    fallbackTimestamp: number
  ): AgentTaskSession['loop']['messages'] {
    const conversationHistory = input.conversationHistory
      ?.filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
      }))

    if (conversationHistory && conversationHistory.length > 0) {
      return conversationHistory
    }

    return [
      {
        role: 'user',
        content: input.prompt,
        timestamp: fallbackTimestamp,
      },
    ]
  }
}
