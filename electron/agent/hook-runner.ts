export type AgentHookEventName = 'SessionStart' | 'PreToolUse' | 'PostToolUse'
export type AgentHookExitCode = 0 | 1 | 2

export interface AgentHookResult {
  exitCode: AgentHookExitCode
  message: string
}

export type AgentHookHandler = (
  payload: Record<string, unknown>
) => AgentHookResult | Promise<AgentHookResult>

export class HookRunner {
  private handlers = new Map<AgentHookEventName, AgentHookHandler[]>()

  register(name: AgentHookEventName, handler: AgentHookHandler): void {
    const existing = this.handlers.get(name) ?? []
    existing.push(handler)
    this.handlers.set(name, existing)
  }

  async run(name: AgentHookEventName, payload: Record<string, unknown>): Promise<AgentHookResult> {
    const handlers = this.handlers.get(name) ?? []
    let latest: AgentHookResult = { exitCode: 0, message: '' }

    for (const handler of handlers) {
      latest = await handler(payload)
      if (latest.exitCode !== 0) {
        return latest
      }
    }

    return latest
  }
}
