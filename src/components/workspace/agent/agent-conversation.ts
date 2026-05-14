import type { AgentApprovalRequest, AgentTaskEvent } from '@/types/agent'

type ActivityStatus = 'running' | 'success' | 'error' | 'unknown'

export type AgentConversationItem =
  | {
      type: 'user'
      id: string
      timestamp: number
      content: string
    }
  | {
      type: 'plan'
      id: string
      timestamp: number
      steps: string[]
    }
  | {
      type: 'tool'
      id: string
      timestamp: number
      name: string
      status: ActivityStatus
      summary?: string
      arguments?: Record<string, unknown>
      result?: unknown
    }
  | {
      type: 'skill'
      id: string
      timestamp: number
      skillId: string
      name?: string
    }
  | {
      type: 'script'
      id: string
      timestamp: number
      label: string
      status: ActivityStatus
      command?: string
      runner?: string
      output: string[]
    }
  | {
      type: 'approval'
      id: string
      timestamp: number
      actionId: string
      title: string
      details: string
    }
  | {
      type: 'assistant'
      id: string
      timestamp: number
      content: string
      tone: 'success' | 'error' | 'rejected'
    }

interface BuildAgentConversationInput {
  events: AgentTaskEvent[]
  approval: AgentApprovalRequest | null
}

export function buildAgentConversationItems({
  events,
  approval,
}: BuildAgentConversationInput): AgentConversationItem[] {
  const items: AgentConversationItem[] = []
  const toolItems: AgentConversationItem[] = []
  const scriptItems: AgentConversationItem[] = []

  events.forEach((taskEvent, index) => {
    if (taskEvent.type === 'task.created') {
      const prompt = getString(taskEvent.payload?.prompt)
      if (prompt) {
        items.push({
          type: 'user',
          id: eventId(taskEvent, index),
          timestamp: taskEvent.timestamp,
          content: prompt,
        })
      }
      return
    }

    if (taskEvent.type === 'plan.generated') {
      const steps = getStringArray(taskEvent.payload?.steps)
      if (steps.length > 0) {
        upsertLatestPlan(items, {
          type: 'plan',
          id: eventId(taskEvent, index),
          timestamp: taskEvent.timestamp,
          steps,
        })
      }
      return
    }

    if (taskEvent.type === 'tool.call.started') {
      const name = getString(taskEvent.payload?.name)
      if (!name) {
        return
      }

      const item: AgentConversationItem = {
        type: 'tool',
        id: eventId(taskEvent, index),
        timestamp: taskEvent.timestamp,
        name,
        status: 'running',
        summary: getString(taskEvent.payload?.summary) || undefined,
        arguments: getRecord(taskEvent.payload?.arguments),
      }
      items.push(item)
      toolItems.push(item)
      return
    }

    if (taskEvent.type === 'tool.call.finished') {
      const name = getString(taskEvent.payload?.name)
      if (!name) {
        return
      }

      const existing = findLastTool(toolItems, name)
      const status = normalizeStatus(taskEvent.payload?.status)
      if (existing) {
        existing.status = status
        existing.summary = getString(taskEvent.payload?.summary) || existing.summary
        existing.result = taskEvent.payload?.result
        return
      }

      const item: AgentConversationItem = {
        type: 'tool',
        id: eventId(taskEvent, index),
        timestamp: taskEvent.timestamp,
        name,
        status,
        summary: getString(taskEvent.payload?.summary) || undefined,
        result: taskEvent.payload?.result,
      }
      items.push(item)
      toolItems.push(item)
      return
    }

    if (taskEvent.type === 'skill.selected') {
      const skillId = getString(taskEvent.payload?.skillId)
      if (skillId) {
        items.push({
          type: 'skill',
          id: eventId(taskEvent, index),
          timestamp: taskEvent.timestamp,
          skillId,
          name: getString(taskEvent.payload?.name) || undefined,
        })
      }
      return
    }

    if (taskEvent.type === 'script.started') {
      const item: AgentConversationItem = {
        type: 'script',
        id: eventId(taskEvent, index),
        timestamp: taskEvent.timestamp,
        label: getScriptLabel(taskEvent.payload),
        status: 'running',
        command: getString(taskEvent.payload?.command) || undefined,
        runner: getString(taskEvent.payload?.runner) || undefined,
        output: [],
      }
      items.push(item)
      scriptItems.push(item)
      return
    }

    if (taskEvent.type === 'script.output') {
      const output = getString(taskEvent.payload?.output)
      if (!output) {
        return
      }

      const existing = findLastScript(scriptItems)
      if (existing) {
        existing.output.push(output)
      } else {
        const item: AgentConversationItem = {
          type: 'script',
          id: eventId(taskEvent, index),
          timestamp: taskEvent.timestamp,
          label: '脚本输出',
          status: 'unknown',
          output: [output],
        }
        items.push(item)
        scriptItems.push(item)
      }
      return
    }

    if (taskEvent.type === 'script.finished') {
      const existing = findLastScript(scriptItems, getScriptLabel(taskEvent.payload))
      if (existing) {
        existing.status = normalizeStatus(taskEvent.payload?.status)
      }
      return
    }

    if (taskEvent.type === 'task.completed') {
      const content = getString(taskEvent.payload?.finalMessage)
      if (content) {
        items.push({
          type: 'assistant',
          id: eventId(taskEvent, index),
          timestamp: taskEvent.timestamp,
          content,
          tone: 'success',
        })
      }
      return
    }

    if (taskEvent.type === 'task.failed') {
      const content = getString(taskEvent.payload?.message) || '任务执行失败。'
      items.push({
        type: 'assistant',
        id: eventId(taskEvent, index),
        timestamp: taskEvent.timestamp,
        content,
        tone: 'error',
      })
      return
    }

    if (taskEvent.type === 'task.rejected') {
      const content = getString(taskEvent.payload?.message) || '用户拒绝了外部操作。'
      items.push({
        type: 'assistant',
        id: eventId(taskEvent, index),
        timestamp: taskEvent.timestamp,
        content,
        tone: 'rejected',
      })
      return
    }

    if (taskEvent.type === 'schedule.due') {
      const name = getString(taskEvent.payload?.name) || '计划任务'
      const prompt = getString(taskEvent.payload?.prompt)
      items.push({
        type: 'assistant',
        id: eventId(taskEvent, index),
        timestamp: taskEvent.timestamp,
        content: prompt ? `计划提醒：${name}\n${prompt}` : `计划提醒：${name}`,
        tone: 'success',
      })
    }
  })

  if (approval) {
    const approvalMatch = findLastEvent(events, 'approval.required')
    items.push({
      type: 'approval',
      id: approvalMatch ? eventId(approvalMatch.event, approvalMatch.index) : approval.actionId,
      timestamp: approvalMatch?.event.timestamp ?? Date.now(),
      actionId: approval.actionId,
      title: approval.title,
      details: approval.details,
    })
  }

  return items
}

function eventId(event: AgentTaskEvent, index: number): string {
  return `${event.taskId}-${event.type}-${event.timestamp}-${index}`
}

function upsertLatestPlan(
  items: AgentConversationItem[],
  nextPlan: Extract<AgentConversationItem, { type: 'plan' }>
): void {
  const existingIndex = findLastIndex(items, (item) => item.type === 'plan')
  if (existingIndex === -1) {
    items.push(nextPlan)
    return
  }

  items.splice(existingIndex, 1, nextPlan)
}

function findLastTool(
  items: AgentConversationItem[],
  name: string
): Extract<AgentConversationItem, { type: 'tool' }> | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const candidate = items[index]
    if (
      candidate.type === 'tool' &&
      candidate.name === name &&
      candidate.status === 'running'
    ) {
      return candidate
    }
  }

  return null
}

function findLastScript(
  items: AgentConversationItem[],
  label?: string
): Extract<AgentConversationItem, { type: 'script' }> | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const candidate = items[index]
    if (
      candidate.type === 'script' &&
      candidate.status === 'running' &&
      (!label || candidate.label === label)
    ) {
      return candidate
    }
  }

  return null
}

function findLastEvent(
  events: AgentTaskEvent[],
  type: AgentTaskEvent['type']
): { event: AgentTaskEvent; index: number } | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.type === type) {
      return { event, index }
    }
  }

  return null
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      return index
    }
  }

  return -1
}

function getScriptLabel(payload?: Record<string, unknown>): string {
  const skillId = getString(payload?.skillId)
  if (skillId) {
    return `Skill ${skillId}`
  }

  return getString(payload?.command) || '脚本执行'
}

function normalizeStatus(value: unknown): ActivityStatus {
  if (value === 'success' || value === 'error') {
    return value
  }

  if (value === 'running') {
    return 'running'
  }

  return 'unknown'
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
