import type { AgentExecutionMode } from '../../src/types/agent.ts'
import type { MCPTool } from '../../src/types/mcp.ts'
import type { AgentMemorySummary } from './memory-store.ts'
import type { AgentSkillSummary } from './skill-registry.ts'

export interface SystemPromptDynamicContext {
  cwd?: string
  currentDate?: string
}

export interface SystemPromptBuilderInput {
  mode: AgentExecutionMode
  tools: MCPTool[]
  skills: AgentSkillSummary[]
  memories: AgentMemorySummary[]
  dynamicContext?: SystemPromptDynamicContext
}

export class SystemPromptBuilder {
  build(input: SystemPromptBuilderInput): string {
    return [
      this.coreInstructions(),
      this.toolSection(input.tools),
      this.skillSection(input.skills),
      this.memorySection(input.memories),
      this.dynamicContextSection(input),
    ]
      .filter(Boolean)
      .join('\n\n')
  }

  private coreInstructions(): string {
    return [
      'You are the AI Box agent planner.',
      'Choose exactly one next action and return only one JSON object.',
      'Allowed action types: call_tool, use_skill, run_script, finish.',
      'Only use tools and skills from the provided context.',
      'Use agent.update_plan to maintain a concise current-task todo list for multi-step work.',
      'Use agent.task for isolated subtasks that benefit from a clean context.',
      'Use agent.load_skill before applying a skill when the summary is not enough.',
      'Use agent.save_memory only for durable, reusable facts or user preferences.',
      'Keep at most one planning item in_progress at a time.',
      'Treat loopState.messages as the authoritative agent loop transcript.',
      'When loopState.transitionReason is a tool, skill, or script result, use that result before deciding the next action.',
      'Include a short summary and an optional plan array when useful.',
    ].join(' ')
  }

  private toolSection(tools: MCPTool[]): string {
    if (tools.length === 0) {
      return '## Available Tools\nNo tools are currently available.'
    }

    return [
      '## Available Tools',
      ...tools.map((tool) => `- ${tool.name}: ${tool.description ?? 'No description provided.'}`),
    ].join('\n')
  }

  private skillSection(skills: AgentSkillSummary[]): string {
    if (skills.length === 0) {
      return '## Available Skills\nNo local skills are currently available.'
    }

    return [
      '## Available Skills',
      ...skills.map((skill) => `- ${skill.id}: ${skill.description}`),
    ].join('\n')
  }

  private memorySection(memories: AgentMemorySummary[]): string {
    if (memories.length === 0) {
      return '## Memory\nNo durable memories are currently available.'
    }

    return [
      '## Memory',
      ...memories.map(
        (memory) => `- ${memory.id} [${memory.type}] ${memory.name}: ${memory.description}`
      ),
    ].join('\n')
  }

  private dynamicContextSection(input: SystemPromptBuilderInput): string {
    return [
      '## Dynamic Context',
      `- executionMode: ${input.mode}`,
      ...(input.dynamicContext?.cwd ? [`- cwd: ${input.dynamicContext.cwd}`] : []),
      ...(input.dynamicContext?.currentDate
        ? [`- currentDate: ${input.dynamicContext.currentDate}`]
        : []),
    ].join('\n')
  }
}
