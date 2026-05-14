import { create } from 'zustand'
import type {
  AgentApprovalRequest,
  AgentTaskEvent,
  AgentTaskStatus,
} from '../../types/agent.ts'

interface ToolTrace {
  name: string
  status: 'running' | 'success' | 'error'
  arguments?: Record<string, unknown>
  result?: unknown
  summary?: string
  traceId?: string
}

interface AgentStoreState {
  currentTaskId: string | null
  status: AgentTaskStatus | 'idle'
  events: AgentTaskEvent[]
  plan: string[]
  selectedSkills: string[]
  toolCalls: ToolTrace[]
  logs: string[]
  finalMessage: string | null
  approval: AgentApprovalRequest | null
  applyEvent: (event: AgentTaskEvent) => void
  reset: () => void
}

const initialState: Omit<AgentStoreState, 'applyEvent' | 'reset'> = {
  currentTaskId: null,
  status: 'idle',
  events: [],
  plan: [],
  selectedSkills: [],
  toolCalls: [],
  logs: [],
  finalMessage: null,
  approval: null,
}

export const createAgentStore = () =>
  create<AgentStoreState>((set) => ({
    ...initialState,
    applyEvent: (event) => {
      set((state) => {
        const nextState: Omit<AgentStoreState, 'applyEvent' | 'reset'> = {
          ...state,
          currentTaskId: event.taskId,
          events:
            event.type === 'task.created'
              ? [event]
              : [...state.events, event],
        }

        if (event.type === 'task.created') {
          nextState.status = 'running'
          nextState.finalMessage = null
          nextState.approval = null
          nextState.logs = [...state.logs, '任务已创建，等待规划器生成下一步。']
          return nextState
        }

        if (event.type === 'plan.generated') {
          nextState.plan = Array.isArray(event.payload?.steps)
            ? event.payload.steps.map((step) => String(step))
            : []
          return nextState
        }

        if (event.type === 'step.started') {
          nextState.status = 'running'
          nextState.approval = null
          nextState.logs = [
            ...state.logs,
            formatStepLog('开始步骤', event.payload),
          ]
          return nextState
        }

        if (event.type === 'step.completed') {
          nextState.logs = [
            ...state.logs,
            formatStepLog('完成步骤', event.payload),
          ]
          return nextState
        }

        if (event.type === 'skill.selected') {
          const skillId = String(event.payload?.skillId ?? '')
          nextState.selectedSkills = skillId
            ? [...state.selectedSkills, skillId]
            : state.selectedSkills
          if (skillId) {
            nextState.logs = [...state.logs, `选中 Skill：${skillId}`]
          }
          return nextState
        }

        if (event.type === 'tool.call.started') {
          nextState.status = 'running'
          nextState.approval = null
          const name = String(event.payload?.name ?? '')
          const summary =
            typeof event.payload?.summary === 'string'
              ? event.payload.summary
              : undefined
          const argumentsValue =
            isRecord(event.payload?.arguments) ? event.payload.arguments : undefined
          const traceId = getTraceId(event.payload)

          nextState.toolCalls = [
            ...state.toolCalls,
            {
              name,
              summary,
              arguments: argumentsValue,
              status: 'running',
              traceId,
            },
          ]
          nextState.logs = [
            ...state.logs,
            `开始调用 MCP 工具：${name}${summary ? ` - ${summary}` : ''}`,
          ]
          return nextState
        }

        if (event.type === 'tool.call.finished') {
          const name = String(event.payload?.name ?? '')
          const summary =
            typeof event.payload?.summary === 'string'
              ? event.payload.summary
              : undefined
          const status =
            event.payload?.status === 'error' ? 'error' : 'success'
          const traceId = getTraceId(event.payload)
          let updated = false

          nextState.toolCalls = state.toolCalls.map((trace) => {
            if (updated) return trace
            if (traceId && trace.traceId === traceId) {
              updated = true
              return {
                ...trace,
                status,
                result: event.payload?.result,
                summary: summary ?? trace.summary,
              }
            }
            if (!traceId && trace.name === name && trace.status === 'running') {
              updated = true
              return {
                ...trace,
                status,
                result: event.payload?.result,
                summary: summary ?? trace.summary,
              }
            }
            return trace
          })

          if (!updated) {
            nextState.toolCalls = [
              ...nextState.toolCalls,
              {
                name,
                result: event.payload?.result,
                summary,
                status,
              },
            ]
          }

          nextState.logs = [
            ...state.logs,
            `MCP 工具调用完成：${name}${summary ? ` - ${summary}` : ''}`,
          ]
          return nextState
        }

        if (event.type === 'script.started') {
          nextState.status = 'running'
          nextState.approval = null
          const label =
            typeof event.payload?.skillId === 'string'
              ? `Skill ${event.payload.skillId}`
              : typeof event.payload?.command === 'string'
                ? event.payload.command
                : '未知脚本'
          nextState.logs = [...state.logs, `开始脚本执行：${label}`]
          return nextState
        }

        if (event.type === 'script.output') {
          const output = String(event.payload?.output ?? '')
          nextState.logs = output ? [...state.logs, output] : state.logs
          return nextState
        }

        if (event.type === 'script.finished') {
          const label =
            typeof event.payload?.skillId === 'string'
              ? `Skill ${event.payload.skillId}`
              : typeof event.payload?.command === 'string'
                ? event.payload.command
                : '未知脚本'
          const status =
            typeof event.payload?.status === 'string' ? event.payload.status : 'unknown'
          nextState.logs = [...state.logs, `脚本执行完成：${label} (${status})`]
          return nextState
        }

        if (event.type === 'approval.required') {
          nextState.status = 'awaiting-approval'
          const approvalRequest = toApprovalRequest(event.payload)
          nextState.approval = approvalRequest
          if (approvalRequest.title) {
            nextState.logs = [...state.logs, `等待确认：${approvalRequest.title}`]
          }
          return nextState
        }

        if (event.type === 'task.completed') {
          nextState.status = 'completed'
          nextState.approval = null
          nextState.finalMessage = String(event.payload?.finalMessage ?? '')
          if (nextState.finalMessage) {
            nextState.logs = [...state.logs, `任务完成：${nextState.finalMessage}`]
          }
          return nextState
        }

        if (event.type === 'task.rejected') {
          nextState.status = 'rejected'
          nextState.approval = null
          const message =
            typeof event.payload?.message === 'string' && event.payload.message.trim()
              ? event.payload.message
              : '用户拒绝了外部操作。'
          nextState.logs = [...state.logs, message]
          return nextState
        }

        if (event.type === 'task.failed') {
          nextState.status = 'failed'
          nextState.approval = null
          if (typeof event.payload?.message === 'string' && event.payload.message.trim()) {
            nextState.logs = [...state.logs, event.payload.message]
          }
          return nextState
        }

        return nextState
      })
    },
    reset: () => set(initialState),
  }))

export const useAgentStore = createAgentStore()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getTraceId(payload?: Record<string, unknown>): string | undefined {
  return typeof payload?.traceId === 'string' ? payload.traceId : undefined
}

function formatStepLog(prefix: string, payload?: Record<string, unknown>): string {
  const actionType = typeof payload?.actionType === 'string' ? payload.actionType : 'unknown'
  const summary = typeof payload?.summary === 'string' ? payload.summary : ''
  const name = typeof payload?.name === 'string' ? payload.name : ''
  const suffix = [summary, name].filter(Boolean).join(' | ')

  return suffix ? `${prefix}：${actionType} - ${suffix}` : `${prefix}：${actionType}`
}

function toApprovalRequest(payload?: Record<string, unknown>): AgentApprovalRequest {
  return {
    actionId:
      typeof payload?.actionId === 'string' && payload.actionId.trim()
        ? payload.actionId
        : 'unknown-action',
    title:
      typeof payload?.title === 'string' && payload.title.trim()
        ? payload.title
        : '需要确认外部操作',
    details:
      typeof payload?.details === 'string' && payload.details.trim()
        ? payload.details
        : 'Agent 请求执行需要确认的外部操作。',
  }
}
