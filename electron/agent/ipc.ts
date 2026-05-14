import type { AgentStartTaskRequest, AgentTaskEvent, AgentTaskSession } from '../../src/types/agent.ts'
import type { AgentRuntime } from './runtime.ts'

interface IpcMainLike {
  handle: (channel: string, handler: (...args: unknown[]) => unknown) => void
}

interface AgentRuntimeLike {
  start: (request: AgentStartTaskRequest) => Promise<AgentTaskSession>
  getTaskState: (taskId: string) => AgentTaskSession | null
  approveAction: (taskId: string, actionId: string) => Promise<AgentTaskSession | null>
  rejectAction: (taskId: string, actionId: string) => AgentTaskSession | null
  cancelTask: (taskId: string) => AgentTaskSession | null
  onTaskEvent: (listener: (event: AgentTaskEvent) => void) => () => void
}

export interface RegisterAgentIpcOptions {
  sendEvent?: (channel: 'agent:task-event', payload: AgentTaskEvent) => void
}

export function registerAgentIpc(
  ipcMainLike: IpcMainLike,
  runtime: Pick<
    AgentRuntime,
    'start' | 'getTaskState' | 'approveAction' | 'rejectAction' | 'cancelTask' | 'onTaskEvent'
  >,
  options: RegisterAgentIpcOptions = {}
): void {
  const runtimeLike = runtime as AgentRuntimeLike

  ipcMainLike.handle('agent:start-task', (_event, request: AgentStartTaskRequest) =>
    runtimeLike.start(request)
  )
  ipcMainLike.handle('agent:get-task-state', (_event, taskId: string) =>
    runtimeLike.getTaskState(taskId)
  )
  ipcMainLike.handle('agent:approve-action', (_event, taskId: string, actionId: string) =>
    runtimeLike.approveAction(taskId, actionId)
  )
  ipcMainLike.handle('agent:reject-action', (_event, taskId: string, actionId: string) =>
    runtimeLike.rejectAction(taskId, actionId)
  )
  ipcMainLike.handle('agent:cancel-task', (_event, taskId: string) =>
    runtimeLike.cancelTask(taskId)
  )

  runtimeLike.onTaskEvent((event) => {
    options.sendEvent?.('agent:task-event', event)
  })
}
