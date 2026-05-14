import type { AgentApprovalRequest, AgentExecutionMode } from '../../src/types/agent.ts'

type ActionDescriptor =
  | { type: 'call_tool'; toolName: string; arguments?: Record<string, unknown> }
  | { type: 'use_skill'; skillId: string }
  | { type: 'run_script'; command: string }
  | { type: 'respond' }

export type PermissionBehavior = 'allow' | 'deny' | 'ask'

export interface PermissionRule {
  tool: string
  behavior: PermissionBehavior
  path?: string
  content?: string
}

export interface ApprovalDecision {
  requiresApproval: boolean
  request: AgentApprovalRequest | null
  behavior?: PermissionBehavior
  reason?: string
}

export interface ApprovalGateOptions {
  rules?: PermissionRule[]
}

export class ApprovalGate {
  private rules: PermissionRule[]

  constructor(options: ApprovalGateOptions = {}) {
    this.rules = options.rules ?? []
  }

  evaluate(mode: AgentExecutionMode, action: ActionDescriptor): ApprovalDecision {
    const denyRule = this.findRule(action, 'deny')
    if (denyRule) {
      return {
        requiresApproval: false,
        request: null,
        behavior: 'deny',
        reason: `Matched deny rule for ${denyRule.tool}`,
      }
    }

    const allowRule = this.findRule(action, 'allow')
    if (allowRule) {
      return {
        requiresApproval: false,
        request: null,
        behavior: 'allow',
        reason: `Matched allow rule for ${allowRule.tool}`,
      }
    }

    if (mode === 'auto') {
      return { requiresApproval: false, request: null, behavior: 'allow' }
    }

    if (action.type === 'call_tool') {
      return {
        requiresApproval: true,
        behavior: 'ask',
        request: {
          actionId: crypto.randomUUID(),
          title: `Call ${action.toolName}`,
          details: `The Agent wants to call MCP tool ${action.toolName}.`,
        },
      }
    }

    if (action.type === 'run_script') {
      return {
        requiresApproval: true,
        behavior: 'ask',
        request: {
          actionId: crypto.randomUUID(),
          title: `Run ${action.command}`,
          details: `The Agent wants to execute ${action.command}.`,
        },
      }
    }

    if (action.type === 'use_skill') {
      return {
        requiresApproval: true,
        behavior: 'ask',
        request: {
          actionId: crypto.randomUUID(),
          title: `Run Skill ${action.skillId}`,
          details: `The Agent wants to execute local Skill ${action.skillId}.`,
        },
      }
    }

    return { requiresApproval: false, request: null, behavior: 'allow' }
  }

  private findRule(
    action: ActionDescriptor,
    behavior: PermissionBehavior
  ): PermissionRule | undefined {
    return this.rules.find(
      (rule) =>
        rule.behavior === behavior &&
        this.matches(rule.tool, this.actionTool(action)) &&
        this.matchesOptional(rule.path, this.actionPath(action)) &&
        this.matchesOptional(rule.content, this.actionContent(action))
    )
  }

  private actionTool(action: ActionDescriptor): string {
    if (action.type === 'call_tool') {
      return action.toolName
    }

    return action.type
  }

  private actionPath(action: ActionDescriptor): string {
    if (action.type !== 'call_tool') {
      return ''
    }

    const path = action.arguments?.path
    return typeof path === 'string' ? path : ''
  }

  private actionContent(action: ActionDescriptor): string {
    if (action.type === 'run_script') {
      return action.command
    }

    if (action.type === 'use_skill') {
      return action.skillId
    }

    if (action.type === 'call_tool') {
      return JSON.stringify(action.arguments ?? {})
    }

    return action.type
  }

  private matchesOptional(pattern: string | undefined, value: string): boolean {
    return !pattern || this.matches(pattern, value)
  }

  private matches(pattern: string, value: string): boolean {
    if (pattern === '*') {
      return true
    }

    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
    return new RegExp(`^${escaped}$`).test(value)
  }
}
