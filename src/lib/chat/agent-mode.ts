import type { AgentTaskStatus } from '@/types/agent'

export type ChatSurfaceMode = 'chat' | 'agent'

export function canSwitchAgentMode(input: {
  currentMode: ChatSurfaceMode
  nextMode: ChatSurfaceMode
  isChatGenerating: boolean
  agentStatus: AgentTaskStatus | 'idle'
}): boolean {
  if (input.currentMode === input.nextMode) {
    return true
  }

  if (input.nextMode === 'agent') {
    return !input.isChatGenerating
  }

  return input.agentStatus !== 'running' && input.agentStatus !== 'awaiting-approval'
}
