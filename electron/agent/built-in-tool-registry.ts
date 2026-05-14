import type { MCPTool } from '../../src/types/mcp.ts'

export const AGENT_UPDATE_PLAN_TOOL_NAME = 'agent.update_plan'
export const AGENT_TASK_TOOL_NAME = 'agent.task'
export const AGENT_LOAD_SKILL_TOOL_NAME = 'agent.load_skill'
export const AGENT_SAVE_MEMORY_TOOL_NAME = 'agent.save_memory'
export const AGENT_TASK_CREATE_TOOL_NAME = 'agent.task_create'
export const AGENT_TASK_UPDATE_TOOL_NAME = 'agent.task_update'
export const AGENT_TASK_GET_TOOL_NAME = 'agent.task_get'
export const AGENT_TASK_LIST_TOOL_NAME = 'agent.task_list'
export const AGENT_BACKGROUND_RUN_TOOL_NAME = 'agent.background_run'
export const AGENT_BACKGROUND_CHECK_TOOL_NAME = 'agent.background_check'
export const AGENT_SCHEDULE_CREATE_TOOL_NAME = 'agent.schedule_create'
export const AGENT_SCHEDULE_LIST_TOOL_NAME = 'agent.schedule_list'
export const AGENT_SCHEDULE_CHECK_TOOL_NAME = 'agent.schedule_check'

const AGENT_UPDATE_PLAN_TOOL: MCPTool = {
  name: AGENT_UPDATE_PLAN_TOOL_NAME,
  description:
    'Update the current task todo list. Use it for multi-step work and keep at most one item in_progress.',
  inputSchema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'Complete replacement list of current task planning items.',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            status: { enum: ['pending', 'in_progress', 'completed'] },
            activeForm: { type: 'string' },
          },
          required: ['content', 'status'],
        },
      },
    },
    required: ['items'],
  },
}

const AGENT_TASK_TOOL: MCPTool = {
  name: AGENT_TASK_TOOL_NAME,
  description: 'Run an isolated one-shot subtask with a clean context and return its summary.',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      description: { type: 'string' },
      tools: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['prompt'],
  },
}

const AGENT_LOAD_SKILL_TOOL: MCPTool = {
  name: AGENT_LOAD_SKILL_TOOL_NAME,
  description: 'Load the full SKILL.md instructions for a locally available skill by id.',
  inputSchema: {
    type: 'object',
    properties: {
      skillId: { type: 'string' },
    },
    required: ['skillId'],
  },
}

const AGENT_SAVE_MEMORY_TOOL: MCPTool = {
  name: AGENT_SAVE_MEMORY_TOOL_NAME,
  description: 'Save durable, reusable user, project, feedback, or reference memory.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      type: { enum: ['user', 'feedback', 'project', 'reference'] },
      description: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['name', 'type', 'description', 'content'],
  },
}

const AGENT_TASK_CREATE_TOOL: MCPTool = {
  name: AGENT_TASK_CREATE_TOOL_NAME,
  description: 'Create a durable task graph item for long-running or dependent work.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      blockedBy: { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'description'],
  },
}

const AGENT_TASK_UPDATE_TOOL: MCPTool = {
  name: AGENT_TASK_UPDATE_TOOL_NAME,
  description: 'Update a durable task graph item status, details, or blockers.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      status: { enum: ['todo', 'in_progress', 'done', 'cancelled'] },
      blockedBy: { type: 'array', items: { type: 'string' } },
    },
    required: ['id'],
  },
}

const AGENT_TASK_GET_TOOL: MCPTool = {
  name: AGENT_TASK_GET_TOOL_NAME,
  description: 'Load one durable task graph item by id.',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
}

const AGENT_TASK_LIST_TOOL: MCPTool = {
  name: AGENT_TASK_LIST_TOOL_NAME,
  description: 'List durable task graph items, optionally only ready work.',
  inputSchema: {
    type: 'object',
    properties: { readyOnly: { type: 'boolean' } },
  },
}

const AGENT_BACKGROUND_RUN_TOOL: MCPTool = {
  name: AGENT_BACKGROUND_RUN_TOOL_NAME,
  description: 'Start a long-running Node, Python, or Shell command in the background.',
  inputSchema: {
    type: 'object',
    properties: {
      runner: { enum: ['node', 'python', 'shell'] },
      command: { type: 'string' },
      cwd: { type: 'string' },
      summary: { type: 'string' },
    },
    required: ['runner', 'command', 'cwd', 'summary'],
  },
}

const AGENT_BACKGROUND_CHECK_TOOL: MCPTool = {
  name: AGENT_BACKGROUND_CHECK_TOOL_NAME,
  description: 'Check a previously started background task by id.',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
}

const AGENT_SCHEDULE_CREATE_TOOL: MCPTool = {
  name: AGENT_SCHEDULE_CREATE_TOOL_NAME,
  description: 'Create a local interval schedule that injects due notifications into the agent.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      prompt: { type: 'string' },
      everyMinutes: { type: 'number' },
      startAt: { type: 'number' },
    },
    required: ['name', 'prompt', 'everyMinutes'],
  },
}

const AGENT_SCHEDULE_LIST_TOOL: MCPTool = {
  name: AGENT_SCHEDULE_LIST_TOOL_NAME,
  description: 'List local Agent schedules.',
  inputSchema: { type: 'object', properties: {} },
}

const AGENT_SCHEDULE_CHECK_TOOL: MCPTool = {
  name: AGENT_SCHEDULE_CHECK_TOOL_NAME,
  description: 'Check local Agent schedules and return due notifications.',
  inputSchema: {
    type: 'object',
    properties: { now: { type: 'number' } },
  },
}

export const BUILT_IN_AGENT_TOOLS: MCPTool[] = [
  AGENT_UPDATE_PLAN_TOOL,
  AGENT_TASK_TOOL,
  AGENT_LOAD_SKILL_TOOL,
  AGENT_SAVE_MEMORY_TOOL,
  AGENT_TASK_CREATE_TOOL,
  AGENT_TASK_UPDATE_TOOL,
  AGENT_TASK_GET_TOOL,
  AGENT_TASK_LIST_TOOL,
  AGENT_BACKGROUND_RUN_TOOL,
  AGENT_BACKGROUND_CHECK_TOOL,
  AGENT_SCHEDULE_CREATE_TOOL,
  AGENT_SCHEDULE_LIST_TOOL,
  AGENT_SCHEDULE_CHECK_TOOL,
]

const TASK_GRAPH_TOOLS = new Set([
  AGENT_TASK_CREATE_TOOL_NAME,
  AGENT_TASK_UPDATE_TOOL_NAME,
  AGENT_TASK_GET_TOOL_NAME,
  AGENT_TASK_LIST_TOOL_NAME,
])

const BACKGROUND_TOOLS = new Set([
  AGENT_BACKGROUND_RUN_TOOL_NAME,
  AGENT_BACKGROUND_CHECK_TOOL_NAME,
])

const SCHEDULE_TOOLS = new Set([
  AGENT_SCHEDULE_CREATE_TOOL_NAME,
  AGENT_SCHEDULE_LIST_TOOL_NAME,
  AGENT_SCHEDULE_CHECK_TOOL_NAME,
])

export function isTaskGraphTool(toolName: string): boolean {
  return TASK_GRAPH_TOOLS.has(toolName)
}

export function isBackgroundTool(toolName: string): boolean {
  return BACKGROUND_TOOLS.has(toolName)
}

export function isScheduleTool(toolName: string): boolean {
  return SCHEDULE_TOOLS.has(toolName)
}

const BUILT_IN_TOOL_NAMES = new Set(BUILT_IN_AGENT_TOOLS.map((tool) => tool.name))

export function isBuiltInTool(toolName: string): boolean {
  return BUILT_IN_TOOL_NAMES.has(toolName)
}
