export interface AgentRecoveryState {
  continuationAttempts: number
  compactAttempts: number
  transportAttempts: number
}

export type AgentRecoveryKind = 'continue' | 'compact' | 'backoff' | 'fail'

export interface AgentRecoveryDecision {
  kind: AgentRecoveryKind
  reason: string
}

export interface RecoveryControllerOptions {
  maxContinuationAttempts?: number
  maxCompactionAttempts?: number
  maxTransportAttempts?: number
}

export interface ChooseRecoveryInput {
  stopReason?: string
  error?: unknown
  state: AgentRecoveryState
}

export class RecoveryController {
  private maxContinuationAttempts: number
  private maxCompactionAttempts: number
  private maxTransportAttempts: number

  constructor(options: RecoveryControllerOptions = {}) {
    this.maxContinuationAttempts = options.maxContinuationAttempts ?? 2
    this.maxCompactionAttempts = options.maxCompactionAttempts ?? 1
    this.maxTransportAttempts = options.maxTransportAttempts ?? 2
  }

  createState(): AgentRecoveryState {
    return {
      continuationAttempts: 0,
      compactAttempts: 0,
      transportAttempts: 0,
    }
  }

  choose(input: ChooseRecoveryInput): AgentRecoveryDecision {
    if (this.isTruncated(input.stopReason, input.error)) {
      if (input.state.continuationAttempts < this.maxContinuationAttempts) {
        input.state.continuationAttempts += 1
        return { kind: 'continue', reason: 'Model output was truncated.' }
      }

      return { kind: 'fail', reason: 'Continuation retry budget exhausted.' }
    }

    if (this.isContextLengthError(input.error)) {
      if (input.state.compactAttempts < this.maxCompactionAttempts) {
        input.state.compactAttempts += 1
        return { kind: 'compact', reason: 'Prompt exceeded provider context length.' }
      }

      return { kind: 'fail', reason: 'Context compaction retry budget exhausted.' }
    }

    if (this.isTransientProviderError(input.error)) {
      if (input.state.transportAttempts < this.maxTransportAttempts) {
        input.state.transportAttempts += 1
        return { kind: 'backoff', reason: 'Provider returned a transient error.' }
      }

      return { kind: 'fail', reason: 'Transient retry budget exhausted.' }
    }

    return { kind: 'fail', reason: 'The error is not recoverable by the agent loop.' }
  }

  private isTruncated(stopReason?: string, error?: unknown): boolean {
    const message = this.errorMessage(error)
    return (
      stopReason === 'max_tokens' ||
      /max[_ -]?tokens|truncated|unexpected end of json/i.test(message)
    )
  }

  private isContextLengthError(error: unknown): boolean {
    return /context length|prompt too long|maximum context|too many tokens/i.test(
      this.errorMessage(error)
    )
  }

  private isTransientProviderError(error: unknown): boolean {
    return /rate limit|timeout|temporar|unavailable|network|socket/i.test(this.errorMessage(error))
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error ?? '')
  }
}
