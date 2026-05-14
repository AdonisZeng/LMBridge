import type { MCPTool } from '../../src/types/mcp.ts'
import type { Message, ProviderConfig } from '../../src/types/providers.ts'

export interface AgentSubagentRunInput {
  prompt: string
  description?: string
  parentTaskId: string
  provider: ProviderConfig
  availableTools: MCPTool[]
}

export interface AgentSubagentRunResult {
  summary: string
  observations: unknown[]
}

export interface DefaultSubagentRunnerOptions {
  callModel: (
    messages: Message[],
    input: AgentSubagentRunInput
  ) => Promise<string>
}

function createMessage(id: string, role: Message['role'], content: string): Message {
  return {
    id,
    role,
    content,
    timestamp: Date.now(),
  }
}

export class DefaultSubagentRunner {
  private options: DefaultSubagentRunnerOptions

  constructor(options: DefaultSubagentRunnerOptions) {
    this.options = options
  }

  async run(input: AgentSubagentRunInput): Promise<AgentSubagentRunResult> {
    const response = await this.options.callModel(
      [
        createMessage(
          'subagent-system',
          'system',
          [
            'You are an isolated subagent for AI Box.',
            'Work only on the delegated prompt, without assuming parent conversation context.',
            'Return a concise result summary for the parent agent.',
          ].join(' ')
        ),
        createMessage(
          'subagent-user',
          'user',
          JSON.stringify(
            {
              prompt: input.prompt,
              description: input.description,
              availableTools: input.availableTools,
            },
            null,
            2
          )
        ),
      ],
      input
    )

    return {
      summary: response,
      observations: [],
    }
  }
}
