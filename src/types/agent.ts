import type { MCPServer } from './mcp'
import type { Message, ProviderConfig } from './providers'

export type AgentExecutionMode = 'auto' | 'confirm-external'
export type AgentTaskStatus =
  | 'running'
  | 'awaiting-approval'
  | 'completed'
  | 'failed'
  | 'rejected'
export type AgentActionStatus = 'success' | 'error'
export type AgentObservationType = 'tool_result' | 'skill_result' | 'script_result'
export type AgentLoopTransitionReason = AgentObservationType | null
export type AgentPlanItemStatus = 'pending' | 'in_progress' | 'completed'

export interface AgentPlanItem {
  content: string
  status: AgentPlanItemStatus
  activeForm?: string
}

export interface AgentPlanningState {
  items: AgentPlanItem[]
  roundsSinceUpdate: number
}

export interface AgentLoopMessage {
  role: 'user' | 'assistant'
  content: string | Record<string, unknown> | Array<Record<string, unknown>>
  timestamp: number
}

export interface AgentLoopState {
  messages: AgentLoopMessage[]
  turnCount: number
  transitionReason: AgentLoopTransitionReason
  compactionCount: number
}

export interface AgentApprovalRequest {
  actionId: string
  title: string
  details: string
}

export type AgentPendingAction =
  | {
      type: 'call_tool'
      actionId?: string
      toolName: string
      arguments: Record<string, unknown>
      summary: string
    }
  | {
      type: 'use_skill'
      actionId?: string
      skillId: string
      summary: string
    }
  | {
      type: 'run_script'
      actionId?: string
      runner: 'node' | 'python' | 'shell'
      command: string
      cwd: string
      summary: string
    }

export interface AgentObservation {
  type: AgentObservationType
  actionId: string
  name: string
  status: AgentActionStatus
  summary: string
  data: Record<string, unknown>
  rawExcerpt: string
  artifacts: string[]
}

export interface AgentTaskEvent {
  type:
    | 'task.created'
    | 'plan.generated'
    | 'step.started'
    | 'skill.selected'
    | 'tool.call.started'
    | 'tool.call.finished'
    | 'script.started'
    | 'script.output'
    | 'script.finished'
    | 'hook.message'
    | 'memory.saved'
    | 'task.recovery'
    | 'graph.task.updated'
    | 'background.task.updated'
    | 'schedule.due'
    | 'approval.required'
    | 'step.completed'
    | 'task.completed'
    | 'task.rejected'
    | 'task.failed'
  taskId: string
  timestamp: number
  payload?: Record<string, unknown>
}

export interface AgentStartTaskRequest {
  prompt: string
  mode: AgentExecutionMode
  provider: ProviderConfig
  mcpServers: MCPServer[]
  conversationHistory?: Message[]
}

export interface AgentTaskSession {
  id: string
  prompt: string
  mode: AgentExecutionMode
  provider: ProviderConfig
  mcpServers: MCPServer[]
  status: AgentTaskStatus
  events: AgentTaskEvent[]
  observations: AgentObservation[]
  planning: AgentPlanningState
  loop: AgentLoopState
  approval: {
    state: 'idle' | 'pending' | 'resolved'
    request: AgentApprovalRequest | null
  }
  pendingAction: AgentPendingAction | null
}
