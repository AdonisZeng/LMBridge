import type { Message } from '@/lib/providers'
import type { AgentTaskEvent } from '@/types/agent'

export type AgentTimelineMessageDraft = Pick<Message, 'role' | 'content' | 'origin' | 'tone'>

export function buildAgentTimelineMessage(
  event: AgentTaskEvent
): AgentTimelineMessageDraft | null {
  if (event.type === 'task.created') {
    return createDraft('Agent 已接手这条任务，正在生成计划。', 'status')
  }

  if (event.type === 'plan.generated') {
    const steps = Array.isArray(event.payload?.steps)
      ? event.payload.steps.map((step) => String(step).trim()).filter(Boolean)
      : []

    if (steps.length === 0) {
      return null
    }

    return createDraft(
      `Agent 计划：\n${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`,
      'status'
    )
  }

  if (event.type === 'approval.required') {
    const title = getString(event.payload?.title) || '需要确认外部操作'
    const details = getString(event.payload?.details)
    return createDraft(details ? `需要你的确认：${title}\n${details}` : `需要你的确认：${title}`, 'status')
  }

  if (event.type === 'task.completed') {
    return createDraft(getString(event.payload?.finalMessage) || 'Agent 已完成任务。', 'success')
  }

  if (event.type === 'task.failed') {
    return createDraft(getString(event.payload?.message) || 'Agent 任务执行失败。', 'error')
  }

  if (event.type === 'task.rejected') {
    return createDraft(getString(event.payload?.message) || '用户拒绝了 Agent 的外部操作请求。', 'rejected')
  }

  return null
}

function createDraft(
  content: string,
  tone: NonNullable<Message['tone']>
): AgentTimelineMessageDraft {
  return {
    role: 'assistant',
    content,
    origin: 'agent',
    tone,
  }
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
