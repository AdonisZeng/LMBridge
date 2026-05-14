import * as assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { AgentRuntime } from './runtime.ts'
import { TaskSessionManager } from './task-session-manager.ts'
import { ToolBroker } from './tool-broker.ts'

function createRequest(mode: 'auto' | 'confirm-external' = 'auto') {
  return {
    prompt: 'Inspect the repo',
    mode,
    provider: {
      id: mode === 'auto' ? 'lmstudio' : 'custom',
      name: mode === 'auto' ? 'LMStudio' : 'Custom',
      baseURL:
        mode === 'auto'
          ? 'http://127.0.0.1:1234/v1'
          : '',
      apiKey: mode === 'auto' ? '' : 'test-key',
      model: mode === 'auto' ? 'qwen3' : 'custom-model',
      apiType: 'openai' as const,
      enabled: true,
    },
    mcpServers:
      mode === 'auto'
        ? [{ id: 'fs', name: 'Filesystem', url: 'http://localhost:3001', connected: true, tools: [] }]
        : [{ id: 'fs', name: 'Filesystem', url: 'http://localhost:3001', connected: true, tools: [] }],
  }
}

test('feeds tool results back into the planner before finishing', async () => {
  const plannerInputs: Array<{
    observations: unknown[]
    loop: { turnCount: number; transitionReason: string | null }
    planning: { roundsSinceUpdate: number }
  }> = []
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: { load: async () => [] },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: {
      listTools: async () => [{ name: 'filesystem.read_file', description: 'Read a file', inputSchema: {} }],
      callTool: async () => ({ text: 'package.json contents' }),
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: { evaluate: () => ({ requiresApproval: false, request: null }) },
    planner: {
      next: async (input) => {
        plannerInputs.push({
          observations: input.observations,
          loop: {
            turnCount: input.loop.turnCount,
            transitionReason: input.loop.transitionReason,
          },
          planning: {
            roundsSinceUpdate: input.planning.roundsSinceUpdate,
          },
        })
        return plannerInputs.length === 1
          ? {
              type: 'call_tool' as const,
              toolName: 'filesystem.read_file',
              arguments: { path: 'package.json' },
              summary: 'Read package.json',
              plan: ['Read package.json', 'Summarize findings'],
            }
          : {
              type: 'finish' as const,
              summary: 'done',
              finalMessage: 'The active provider is configured in package.json.',
            }
      },
    },
  })

  const result = await runtime.start(createRequest())

  assert.equal(result.status, 'completed')
  assert.equal(plannerInputs.length, 2)
  assert.equal(plannerInputs[1]?.observations.length, 1)
  assert.deepEqual(plannerInputs.map((input) => input.loop), [
    { turnCount: 1, transitionReason: null },
    { turnCount: 2, transitionReason: 'tool_result' },
  ])
  assert.deepEqual(plannerInputs.map((input) => input.planning), [
    { roundsSinceUpdate: 0 },
    { roundsSinceUpdate: 1 },
  ])
  assert.equal(result.loop.turnCount, 2)
  assert.equal(result.loop.transitionReason, null)
  assert.equal(result.loop.messages[0]?.role, 'user')
  assert.equal(result.loop.messages[1]?.role, 'assistant')
  assert.deepEqual(result.loop.messages[1]?.content, {
    type: 'call_tool',
    toolName: 'filesystem.read_file',
    arguments: { path: 'package.json' },
    summary: 'Read package.json',
    plan: ['Read package.json', 'Summarize findings'],
    tool_use_id: result.observations[0]?.actionId,
  })
  assert.deepEqual(result.loop.messages[2]?.content, [
    {
      type: 'tool_result',
      tool_use_id: result.observations[0]?.actionId,
      status: 'success',
      name: 'filesystem.read_file',
      summary: 'Read package.json',
      content: JSON.stringify({ text: 'package.json contents' }),
      artifacts: [],
    },
  ])
  assert.equal(result.loop.messages[3]?.role, 'assistant')
  assert.equal(result.events.some((event) => event.type === 'step.started'), true)
  assert.equal(result.events.some((event) => event.type === 'step.completed'), true)
})

test('updates session planning through the built-in planning tool', async () => {
  const plannerInputs: Array<{
    tools: string[]
    planning: { items: unknown[]; roundsSinceUpdate: number }
  }> = []
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: { load: async () => [] },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: {
      listTools: async () => [],
      callTool: async () => {
        throw new Error('tool broker should not handle the built-in planning tool')
      },
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: {
      evaluate: () => {
        throw new Error('planning updates are internal and should not require approval')
      },
    },
    planner: {
      next: async (input) => {
        plannerInputs.push({
          tools: input.tools.map((tool) => tool.name),
          planning: {
            items: input.planning.items,
            roundsSinceUpdate: input.planning.roundsSinceUpdate,
          },
        })

        return input.observations.length === 0
          ? {
              type: 'call_tool' as const,
              toolName: 'agent.update_plan',
              arguments: {
                items: [
                  {
                    content: 'Inspect Agent planning state',
                    status: 'completed',
                  },
                  {
                    content: 'Wire update_plan into the loop',
                    status: 'in_progress',
                    activeForm: 'Wiring update_plan into the loop',
                  },
                ],
              },
              summary: 'Update the current task plan',
            }
          : {
              type: 'finish' as const,
              summary: 'done',
              finalMessage: 'Planning state updated.',
            }
      },
    },
  })
  const events: Array<{ type: string; payload?: Record<string, unknown> }> = []
  runtime.onTaskEvent((event) => events.push(event))

  const result = await runtime.start({
    ...createRequest('confirm-external'),
    mcpServers: [],
  })

  assert.equal(result.status, 'completed')
  assert.equal(plannerInputs[0]?.tools.includes('agent.update_plan'), true)
  assert.deepEqual(plannerInputs.map((input) => input.planning.roundsSinceUpdate), [0, 0])
  assert.deepEqual(result.planning.items, [
    {
      content: 'Inspect Agent planning state',
      status: 'completed',
    },
    {
      content: 'Wire update_plan into the loop',
      status: 'in_progress',
      activeForm: 'Wiring update_plan into the loop',
    },
  ])
  assert.equal(result.observations[0]?.name, 'agent.update_plan')
  assert.equal(
    events.some(
      (event) =>
        event.type === 'plan.generated' &&
        Array.isArray(event.payload?.steps) &&
        event.payload.steps.includes('[in_progress] Wiring update_plan into the loop')
    ),
    true
  )
})

test('runs isolated subtask through the built-in task tool', async () => {
  const subagentInputs: Array<{ prompt: string; parentTaskId: string; availableTools: string[] }> = []
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: { load: async () => [] },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: {
      listTools: async () => [{ name: 'local.read_file', description: 'Read local files', inputSchema: {} }],
      callTool: async () => {
        throw new Error('tool broker should not handle the built-in task tool')
      },
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: {
      evaluate: () => {
        throw new Error('agent.task is internal and should not require approval')
      },
    },
    subagentRunner: {
      run: async (input) => {
        subagentInputs.push({
          prompt: input.prompt,
          parentTaskId: input.parentTaskId,
          availableTools: input.availableTools.map((tool) => tool.name),
        })
        return {
          summary: 'Subtask found the package name.',
          observations: [{ text: 'isolated context only' }],
        }
      },
    },
    planner: {
      next: async (input) =>
        input.observations.length === 0
          ? {
              type: 'call_tool' as const,
              toolName: 'agent.task',
              arguments: {
                prompt: 'Find the package name without using parent context.',
                description: 'Inspect package metadata',
                tools: ['local.read_file'],
              },
              summary: 'Delegate package inspection',
            }
          : {
              type: 'finish' as const,
              summary: 'done',
              finalMessage: 'Subtask complete.',
            },
    },
  })

  const result = await runtime.start(createRequest())

  assert.equal(result.status, 'completed')
  assert.equal(subagentInputs.length, 1)
  assert.equal(subagentInputs[0]?.prompt, 'Find the package name without using parent context.')
  assert.deepEqual(subagentInputs[0]?.availableTools, ['local.read_file'])
  assert.equal(result.observations[0]?.name, 'agent.task')
  assert.match(result.observations[0]?.rawExcerpt ?? '', /Subtask found/)
})

test('loads skill instructions on demand through the built-in skill loader', async () => {
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: {
      load: async () => [
        {
          id: 'repo-summary',
          name: 'repo-summary',
          description: 'Summarize repositories',
          rootDir: 'C:/skills/repo-summary',
          tags: ['code'],
          isExecutable: false,
          allowedMcpTools: [],
          entrypoints: [],
        },
      ],
      loadContent: async (skillId: string) => ({
        id: skillId,
        content: '# Repo Summary\n\nUse this skill to summarize the repository.',
      }),
    },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: {
      listTools: async () => [],
      callTool: async () => {
        throw new Error('tool broker should not handle the built-in skill loader')
      },
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: {
      evaluate: () => {
        throw new Error('agent.load_skill is internal and should not require approval')
      },
    },
    planner: {
      next: async (input) =>
        input.observations.length === 0
          ? {
              type: 'call_tool' as const,
              toolName: 'agent.load_skill',
              arguments: { skillId: 'repo-summary' },
              summary: 'Load repo-summary instructions',
            }
          : {
              type: 'finish' as const,
              summary: 'done',
              finalMessage: 'Skill instructions loaded.',
            },
    },
  })

  const result = await runtime.start(createRequest())

  assert.equal(result.status, 'completed')
  assert.equal(result.observations[0]?.name, 'agent.load_skill')
  assert.match(result.observations[0]?.rawExcerpt ?? '', /# Repo Summary/)
})

test('loads memory into planner context and saves memory through the built-in memory tool', async () => {
  const savedMemories: unknown[] = []
  const plannerInputs: Array<{ memories: unknown[]; tools: string[] }> = []
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: { load: async () => [] },
    memoryStore: {
      list: async () => [
        {
          id: 'prefer-concise',
          name: 'Prefer concise',
          type: 'user',
          description: 'User prefers concise responses.',
          content: 'Keep final answers concise.',
        },
      ],
      save: async (input) => {
        savedMemories.push(input)
        return {
          id: 'repo-fact',
          name: input.name,
          type: input.type,
          description: input.description,
          content: input.content,
        }
      },
    },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: {
      listTools: async () => [],
      callTool: async () => {
        throw new Error('tool broker should not handle the built-in memory tool')
      },
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: {
      evaluate: () => {
        throw new Error('agent.save_memory is internal and should not require approval')
      },
    },
    planner: {
      next: async (input) => {
        plannerInputs.push({
          memories: input.memories,
          tools: input.tools.map((tool) => tool.name),
        })

        return input.observations.length === 0
          ? {
              type: 'call_tool' as const,
              toolName: 'agent.save_memory',
              arguments: {
                name: 'Repo fact',
                type: 'project',
                description: 'The repository name discovered during the task.',
                content: 'The package name is ai-box.',
              },
              summary: 'Save a reusable repository fact',
            }
          : {
              type: 'finish' as const,
              summary: 'done',
              finalMessage: 'Memory saved.',
            }
      },
    },
  })

  const result = await runtime.start(createRequest())

  assert.equal(result.status, 'completed')
  assert.equal(plannerInputs[0]?.tools.includes('agent.save_memory'), true)
  assert.equal(plannerInputs[0]?.memories.length, 1)
  assert.equal(savedMemories.length, 1)
  assert.equal(result.observations[0]?.name, 'agent.save_memory')
})

test('creates graph tasks through the built-in task graph tool', async () => {
  const createdTasks: unknown[] = []
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: { load: async () => [] },
    taskGraph: {
      create: async (input) => {
        createdTasks.push(input)
        return {
          id: 'task-1',
          title: input.title,
          description: input.description,
          status: 'todo',
          blockedBy: input.blockedBy ?? [],
          blocks: [],
          ready: true,
          createdAt: 1,
          updatedAt: 1,
        }
      },
      update: async () => {
        throw new Error('update should not be called')
      },
      get: async () => null,
      list: async () => [],
    },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: {
      listTools: async () => [],
      callTool: async () => {
        throw new Error('tool broker should not handle task graph tools')
      },
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: { evaluate: () => ({ requiresApproval: false, request: null }) },
    planner: {
      next: async (input) =>
        input.observations.length === 0
          ? {
              type: 'call_tool' as const,
              toolName: 'agent.task_create',
              arguments: {
                title: 'Implement final Agent tools',
                description: 'Add task graph, background, schedule, and capability routing.',
              },
              summary: 'Create a durable task graph item',
            }
          : {
              type: 'finish' as const,
              summary: 'done',
              finalMessage: 'Task created.',
            },
    },
  })

  const result = await runtime.start(createRequest())

  assert.equal(result.status, 'completed')
  assert.equal(createdTasks.length, 1)
  assert.equal(result.observations[0]?.name, 'agent.task_create')
})

test('starts background work through the built-in background tool', async () => {
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: { load: async () => [] },
    backgroundTasks: {
      start: async (input) => ({
        id: 'bg-1',
        runner: input.runner,
        command: input.command,
        cwd: input.cwd,
        summary: input.summary,
        status: 'running',
        stdout: '',
        stderr: '',
        logPath: 'C:/logs/bg-1.log',
        createdAt: 1,
        updatedAt: 1,
      }),
      check: async () => null,
    },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: {
      listTools: async () => [],
      callTool: async () => {
        throw new Error('tool broker should not handle background tools')
      },
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: { evaluate: () => ({ requiresApproval: false, request: null }) },
    planner: {
      next: async (input) =>
        input.observations.length === 0
          ? {
              type: 'call_tool' as const,
              toolName: 'agent.background_run',
              arguments: {
                runner: 'shell',
                command: 'scripts/slow-task.sh',
                cwd: 'D:/Development/Electron/AI-Box',
                summary: 'Run a slow verification command',
              },
              summary: 'Start background verification',
            }
          : {
              type: 'finish' as const,
              summary: 'done',
              finalMessage: 'Background task started.',
            },
    },
  })

  const result = await runtime.start(createRequest())

  assert.equal(result.status, 'completed')
  assert.equal(result.observations[0]?.name, 'agent.background_run')
  assert.match(result.observations[0]?.rawExcerpt ?? '', /bg-1/)
})

test('reports due schedules through the built-in schedule check tool', async () => {
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: { load: async () => [] },
    scheduleStore: {
      create: async () => {
        throw new Error('create should not be called')
      },
      list: async () => [],
      checkDue: async () => [
        {
          scheduleId: 'sched-1',
          name: 'Check background task',
          prompt: 'Check if the background task finished.',
          dueAt: 1,
        },
      ],
    },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: {
      listTools: async () => [],
      callTool: async () => {
        throw new Error('tool broker should not handle schedule tools')
      },
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: { evaluate: () => ({ requiresApproval: false, request: null }) },
    planner: {
      next: async (input) =>
        input.observations.length === 0
          ? {
              type: 'call_tool' as const,
              toolName: 'agent.schedule_check',
              arguments: { now: 1 },
              summary: 'Check due schedules',
            }
          : {
              type: 'finish' as const,
              summary: 'done',
              finalMessage: 'Schedule notifications checked.',
            },
    },
  })
  const events: Array<{ type: string }> = []
  runtime.onTaskEvent((event) => events.push({ type: event.type }))

  const result = await runtime.start(createRequest())

  assert.equal(result.status, 'completed')
  assert.equal(result.observations[0]?.name, 'agent.schedule_check')
  assert.equal(events.some((event) => event.type === 'schedule.due'), true)
})

test('routes prefixed MCP tools through the capability router before calling the broker', async () => {
  const calls: Array<{ serverId: string | null; toolName: string }> = []
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: { load: async () => [] },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: {
      listTools: async () => [],
      callTool: async (server, toolName) => {
        calls.push({ serverId: server?.id ?? null, toolName })
        return { content: 'ok' }
      },
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: { evaluate: () => ({ requiresApproval: false, request: null }) },
    planner: {
      next: async (input) => {
        if (input.observations.length > 0) {
          return {
            type: 'finish' as const,
            summary: 'done',
            finalMessage: 'MCP tool routed.',
          }
        }

        assert.equal(input.tools.some((tool) => tool.name === 'mcp__fs__read_file'), true)
        return {
          type: 'call_tool' as const,
          toolName: 'mcp__fs__read_file',
          arguments: { path: 'package.json' },
          summary: 'Read via prefixed MCP tool',
        }
      },
    },
  })

  const result = await runtime.start({
    ...createRequest(),
    mcpServers: [
      {
        id: 'fs',
        name: 'Filesystem',
        url: 'http://localhost:3001',
        connected: true,
        tools: [{ name: 'read_file', description: 'Read a file', inputSchema: {} }],
      },
    ],
  })

  assert.equal(result.status, 'completed')
  assert.deepEqual(calls, [{ serverId: 'fs', toolName: 'read_file' }])
})

test('recovers from a prompt-length planner failure by compacting loop context and retrying', async () => {
  let plannerCalls = 0
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: { load: async () => [] },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: {
      listTools: async () => [],
      callTool: async () => {
        throw new Error('tool broker should not be called in this test')
      },
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: { evaluate: () => ({ requiresApproval: false, request: null }) },
    planner: {
      next: async () => {
        plannerCalls += 1
        if (plannerCalls === 1) {
          throw new Error('context length exceeded')
        }

        return {
          type: 'finish' as const,
          summary: 'done',
          finalMessage: 'Recovered after compaction.',
        }
      },
    },
  })

  const result = await runtime.start(createRequest())

  assert.equal(result.status, 'completed')
  assert.equal(plannerCalls, 2)
  assert.equal(result.loop.compactionCount, 1)
  assert.equal(result.events.some((event) => event.type === 'task.recovery'), true)
})

test('blocks a tool when a pre-tool hook rejects the call', async () => {
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: { load: async () => [] },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: {
      listTools: async () => [{ name: 'local.write_file', description: 'Write local files', inputSchema: {} }],
      callTool: async () => {
        throw new Error('tool broker should not run a hook-blocked tool')
      },
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: { evaluate: () => ({ requiresApproval: false, request: null }) },
    hooks: {
      run: async (name) =>
        name === 'PreToolUse'
          ? { exitCode: 1, message: 'Hook blocked local.write_file.' }
          : { exitCode: 0, message: '' },
    },
    planner: {
      next: async () => ({
        type: 'call_tool' as const,
        toolName: 'local.write_file',
        arguments: { path: 'README.md', content: 'unsafe' },
        summary: 'Write README',
      }),
    },
  })

  const result = await runtime.start(createRequest())

  assert.equal(result.status, 'failed')
  assert.match(result.events.at(-1)?.payload?.message as string, /Hook blocked/)
})

test('emits skill selection and records the skill observation before finishing', async () => {
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: {
      load: async () => [
        {
          id: 'repo-summary',
          name: 'repo-summary',
          description: 'Summarize repositories',
          rootDir: 'C:/Users/33664/.agents/skills/repo-summary',
          tags: ['code'],
          isExecutable: true,
          allowedMcpTools: ['filesystem.read_file'],
          entrypoints: [{ runner: 'python', command: 'scripts/run.py' }],
        },
      ],
    },
    skillExecutor: {
      execute: async () => ({
        status: 'success' as const,
        summary: 'repo-summary completed',
        rawExcerpt: 'summary-ready',
        observation: {
          type: 'skill_result',
          actionId: 'skill-repo-summary',
          name: 'repo-summary',
          status: 'success',
          summary: 'repo-summary completed',
          data: { stdout: 'summary-ready' },
          rawExcerpt: 'summary-ready',
          artifacts: [],
        },
      }),
    },
    toolBroker: {
      listTools: async () => [],
      callTool: async () => {
        throw new Error('tool broker should not be called in this test')
      },
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: { evaluate: () => ({ requiresApproval: false, request: null }) },
    planner: {
      next: async (input) =>
        input.observations.length === 0
          ? {
              type: 'use_skill' as const,
              skillId: 'repo-summary',
              summary: 'Run repo-summary',
              plan: ['Run repo-summary', 'Respond'],
            }
          : {
              type: 'finish' as const,
              summary: 'done',
              finalMessage: 'Repository summary completed.',
            },
    },
  })

  const result = await runtime.start({
    ...createRequest(),
    prompt: 'Summarize the repository',
    mcpServers: [],
  })

  assert.equal(result.status, 'completed')
  assert.equal(result.events.some((event) => event.type === 'skill.selected'), true)
  assert.equal(result.observations[0]?.type, 'skill_result')
})

test('pauses when approval is required', async () => {
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: { load: async () => [] },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: {
      listTools: async () => [{ name: 'filesystem.read_file', description: 'Read a file', inputSchema: {} }],
      callTool: async () => ({ text: 'never called' }),
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: {
      evaluate: () => ({
        requiresApproval: true,
        request: {
          actionId: 'step-1',
          title: 'Call filesystem.read_file',
          details: 'Read package.json',
        },
      }),
    },
    planner: {
      next: async () => ({
        type: 'call_tool' as const,
        toolName: 'filesystem.read_file',
        arguments: { path: 'package.json' },
        summary: 'Read package.json',
      }),
    },
  })

  const result = await runtime.start(createRequest('confirm-external'))

  assert.equal(result.status, 'awaiting-approval')
  assert.equal(result.approval.request?.title, 'Call filesystem.read_file')
})

test('resumes the pending action after approval', async () => {
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: { load: async () => [] },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: {
      listTools: async () => [{ name: 'filesystem.read_file', description: 'Read a file', inputSchema: {} }],
      callTool: async () => ({ text: 'package.json contents' }),
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: {
      evaluate: (mode) =>
        mode === 'confirm-external'
          ? {
              requiresApproval: true,
              request: {
                actionId: 'step-1',
                title: 'Call filesystem.read_file',
                details: 'Read package.json',
              },
            }
          : { requiresApproval: false, request: null },
    },
    planner: {
      next: async (input) =>
        input.observations.length === 0
          ? {
              type: 'call_tool' as const,
              toolName: 'filesystem.read_file',
              arguments: { path: 'package.json' },
              summary: 'Read package.json',
            }
          : {
              type: 'finish' as const,
              summary: 'done',
              finalMessage: 'Approved execution complete.',
            },
    },
  })

  const blocked = await runtime.start(createRequest('confirm-external'))
  const resumed = await runtime.approveAction(blocked.id, 'step-1')

  assert.equal(resumed?.status, 'completed')
  assert.equal(resumed?.observations.length, 1)
})

test('runs local tools without configured MCP servers', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-runtime-local-tools-'))
  writeFileSync(join(root, 'package.json'), '{"name":"ai-box"}')
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: { load: async () => [] },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: new ToolBroker({ localRootDir: root }),
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: { evaluate: () => ({ requiresApproval: false, request: null }) },
    planner: {
      next: async (input) =>
        input.observations.length === 0
          ? {
              type: 'call_tool' as const,
              toolName: 'local.read_file',
              arguments: { path: 'package.json' },
              summary: 'Read local package metadata',
            }
          : {
              type: 'finish' as const,
              summary: 'done',
              finalMessage: 'Local package metadata read.',
            },
    },
  })

  const result = await runtime.start({
    ...createRequest(),
    mcpServers: [],
  })

  assert.equal(result.status, 'completed')
  assert.equal(result.observations[0]?.name, 'local.read_file')
  assert.deepEqual(result.observations[0]?.data, {
    result: {
      path: 'package.json',
      content: '{"name":"ai-box"}',
    },
  })
  assert.equal(result.loop.transitionReason, null)
})

test('emits a rejected event when approval is rejected', async () => {
  const events: Array<{ type: string }> = []
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: { load: async () => [] },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: {
      listTools: async () => [{ name: 'filesystem.read_file', description: 'Read a file', inputSchema: {} }],
      callTool: async () => ({ text: 'never called' }),
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: {
      evaluate: () => ({
        requiresApproval: true,
        request: {
          actionId: 'step-1',
          title: 'Call filesystem.read_file',
          details: 'Read package.json',
        },
      }),
    },
    planner: {
      next: async () => ({
        type: 'call_tool' as const,
        toolName: 'filesystem.read_file',
        arguments: { path: 'package.json' },
        summary: 'Read package.json',
      }),
    },
  })
  runtime.onTaskEvent((event) => events.push({ type: event.type }))

  const blocked = await runtime.start(createRequest('confirm-external'))
  const rejected = runtime.rejectAction(blocked.id, 'step-1')

  assert.equal(rejected?.status, 'rejected')
  assert.equal(events.at(-1)?.type, 'task.rejected')
})

test('pauses executable skill use in confirm-external mode before running it', async () => {
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: {
      load: async () => [
        {
          id: 'repo-summary',
          name: 'repo-summary',
          description: 'Summarize repositories',
          rootDir: 'C:/Users/33664/.agents/skills/repo-summary',
          tags: ['code'],
          isExecutable: true,
          allowedMcpTools: [],
          entrypoints: [{ runner: 'node', command: 'scripts/run.js' }],
        },
      ],
    },
    skillExecutor: {
      execute: async () => ({
        status: 'success' as const,
        summary: 'repo-summary completed',
        rawExcerpt: 'summary-ready',
        observation: {
          type: 'skill_result',
          actionId: 'skill-repo-summary',
          name: 'repo-summary',
          status: 'success',
          summary: 'repo-summary completed',
          data: { stdout: 'summary-ready' },
          rawExcerpt: 'summary-ready',
          artifacts: [],
        },
      }),
    },
    toolBroker: {
      listTools: async () => [],
      callTool: async () => {
        throw new Error('tool broker should not be called in this test')
      },
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: {
      evaluate: (mode, action) =>
        mode === 'confirm-external' &&
        (action.type === 'call_tool' ||
          action.type === 'run_script' ||
          action.type === 'use_skill')
          ? {
              requiresApproval: true,
              request: {
                actionId: 'skill-step',
                title:
                  action.type === 'use_skill'
                    ? `Run Skill ${action.skillId}`
                    : 'External action',
                details: 'Confirm external action',
              },
            }
          : { requiresApproval: false, request: null },
    },
    planner: {
      next: async (input) =>
        input.observations.length === 0
          ? {
              type: 'use_skill' as const,
              skillId: 'repo-summary',
              summary: 'Run repo-summary',
            }
          : {
              type: 'finish' as const,
              summary: 'done',
              finalMessage: 'Skill execution complete.',
            },
    },
  })

  const blocked = await runtime.start({
    ...createRequest('confirm-external'),
    mcpServers: [],
  })
  assert.equal(blocked.status, 'awaiting-approval')
  assert.equal(blocked.approval.request?.title, 'Run Skill repo-summary')
  assert.equal(blocked.observations.length, 0)

  const resumed = await runtime.approveAction(blocked.id, 'skill-step')
  assert.equal(resumed?.status, 'completed')
  assert.equal(resumed?.observations[0]?.type, 'skill_result')
})

test('fails when maxTurns is exceeded', async () => {
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: { load: async () => [] },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: {
      listTools: async () => [],
      callTool: async () => {
        throw new Error('tool broker should not be called in this test')
      },
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: { evaluate: () => ({ requiresApproval: false, request: null }) },
    planner: {
      next: async () => ({
        type: 'call_tool' as const,
        toolName: 'agent.update_plan',
        arguments: { items: [{ content: 'step', status: 'in_progress' }] },
        summary: 'Keep running',
      }),
    },
    maxTurns: 3,
  })

  const result = await runtime.start(createRequest())

  assert.equal(result.status, 'failed')
  assert.equal(result.events.some((e) => e.type === 'task.failed'), true)
  assert.match(
    result.events.find((e) => e.type === 'task.failed')?.payload?.message as string,
    /Maximum turns exceeded/
  )
})

test('feeds tool call errors back to planner instead of failing the task', async () => {
  const plannerInputs: Array<{ observations: unknown[] }> = []
  const runtime = new AgentRuntime({
    sessions: new TaskSessionManager(),
    skillRegistry: { load: async () => [] },
    skillExecutor: {
      execute: async () => {
        throw new Error('skill executor should not be called in this test')
      },
    },
    toolBroker: {
      listTools: async () => [
        { name: 'filesystem.read_file', description: 'Read a file', inputSchema: {} },
      ],
      callTool: async () => {
        throw new Error('File not found')
      },
    },
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
    approvalGate: { evaluate: () => ({ requiresApproval: false, request: null }) },
    planner: {
      next: async (input) => {
        plannerInputs.push({ observations: input.observations })
        if (input.observations.length === 0) {
          return {
            type: 'call_tool' as const,
            toolName: 'filesystem.read_file',
            arguments: { path: 'missing.txt' },
            summary: 'Read missing file',
          }
        }
        return {
          type: 'finish' as const,
          summary: 'done',
          finalMessage: 'Recovered from tool error.',
        }
      },
    },
  })

  const result = await runtime.start(createRequest())

  assert.equal(result.status, 'completed')
  assert.equal(plannerInputs.length, 2)
  assert.equal(plannerInputs[1]?.observations.length, 1)
  assert.equal((plannerInputs[1]?.observations[0] as { status: string })?.status, 'error')
  assert.equal(
    (plannerInputs[1]?.observations[0] as { data: { result: { error: string } } })?.data?.result
      ?.error,
    'File not found'
  )
  assert.equal(result.observations[0]?.status, 'error')
  assert.equal(result.events.some((e) => e.type === 'tool.call.finished'), true)
})
