import * as assert from 'node:assert/strict'
import { rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  TaskSessionManager,
  type CreateTaskSessionInput,
} from './task-session-manager.ts'

test('creates a task session with the requested mode and provider config', () => {
  const manager = new TaskSessionManager()
  const input: CreateTaskSessionInput = {
    prompt: 'Summarize this project',
    mode: 'auto',
    provider: {
      id: 'lmstudio',
      name: 'LMStudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: '',
      model: 'qwen3',
      apiType: 'openai',
      enabled: true,
    },
    mcpServers: [],
  }

  const session = manager.create(input)

  assert.equal(session.prompt, input.prompt)
  assert.equal(session.mode, 'auto')
  assert.equal(session.status, 'running')
  assert.equal(session.events.length, 1)
  assert.equal(session.events[0]?.type, 'task.created')
  assert.deepEqual(session.planning, { items: [], roundsSinceUpdate: 0 })
  assert.equal(session.loop.turnCount, 1)
  assert.equal(session.loop.compactionCount, 0)
  assert.equal(session.loop.transitionReason, null)
  assert.deepEqual(session.loop.messages, [
    {
      role: 'user',
      content: input.prompt,
      timestamp: session.loop.messages[0]?.timestamp,
    },
  ])
})

test('seeds the agent loop from shared conversation history when provided', () => {
  const manager = new TaskSessionManager()
  const session = manager.create({
    prompt: 'Use the agent to continue from here',
    mode: 'auto',
    provider: {
      id: 'lmstudio',
      name: 'LMStudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: '',
      model: 'qwen3',
      apiType: 'openai',
      enabled: true,
    },
    mcpServers: [],
    conversationHistory: [
      {
        id: 'message-1',
        role: 'assistant',
        content: '你好！我是 AI Box 助手。',
        timestamp: 101,
      },
      {
        id: 'message-2',
        role: 'user',
        content: '先帮我看看 package.json。',
        timestamp: 102,
      },
      {
        id: 'message-3',
        role: 'assistant',
        content: '我建议再用 Agent 深入检查。',
        timestamp: 103,
      },
      {
        id: 'message-4',
        role: 'system',
        content: 'skip me',
        timestamp: 104,
      },
      {
        id: 'message-5',
        role: 'user',
        content: 'Use the agent to continue from here',
        timestamp: 105,
      },
    ],
  })

  assert.deepEqual(session.loop.messages, [
    {
      role: 'assistant',
      content: '你好！我是 AI Box 助手。',
      timestamp: 101,
    },
    {
      role: 'user',
      content: '先帮我看看 package.json。',
      timestamp: 102,
    },
    {
      role: 'assistant',
      content: '我建议再用 Agent 深入检查。',
      timestamp: 103,
    },
    {
      role: 'user',
      content: 'Use the agent to continue from here',
      timestamp: 105,
    },
  ])
  assert.equal(
    session.loop.messages.some((message) => message.content === session.prompt),
    true
  )
})

test('compacts large tool results in the active loop transcript', () => {
  const manager = new TaskSessionManager()
  const session = manager.create({
    prompt: 'Read a large file',
    mode: 'auto',
    provider: {
      id: 'lmstudio',
      name: 'LMStudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: '',
      model: 'qwen3',
      apiType: 'openai',
      enabled: true,
    },
    mcpServers: [],
  })
  const largeContent = 'a'.repeat(1400)

  manager.recordObservationWriteBack(session.id, {
    type: 'tool_result',
    actionId: 'tool-large',
    name: 'local.read_file',
    status: 'success',
    summary: 'Read a large file',
    data: { result: largeContent },
    rawExcerpt: largeContent,
    artifacts: [],
  })

  const updated = manager.get(session.id)
  const writeBack = updated?.loop.messages[1]?.content

  assert.equal(updated?.loop.compactionCount, 1)
  assert.equal(Array.isArray(writeBack), true)
  assert.match(String(Array.isArray(writeBack) ? writeBack[0]?.content : ''), /content compacted/)
  assert.equal(updated?.observations.length, 0)
})

test('records observations and resumes after approval', () => {
  const manager = new TaskSessionManager()
  const session = manager.create({
    prompt: 'Read config and report provider',
    mode: 'confirm-external',
    provider: {
      id: 'lmstudio',
      name: 'LMStudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: 'test-key',
      model: 'local-model',
      apiType: 'openai',
      enabled: true,
    },
    mcpServers: [],
  })

  manager.setAwaitingApproval(
    session.id,
    {
      actionId: 'step-2',
      title: 'Call filesystem.read_file',
      details: 'Read package.json',
    },
    {
      type: 'call_tool',
      toolName: 'filesystem.read_file',
      arguments: { path: 'package.json' },
      summary: 'Read package.json',
    }
  )
  manager.addObservation(session.id, {
    type: 'tool_result',
    actionId: 'step-2',
    name: 'filesystem.read_file',
    status: 'success',
    summary: 'Read package.json',
    data: { path: 'package.json' },
    rawExcerpt: '{"name":"ai-box"}',
    artifacts: [],
  })

  const pending = manager.approve(session.id)
  const updated = manager.get(session.id)

  assert.equal(pending?.type, 'call_tool')
  assert.equal(updated?.approval?.state, 'resolved')
  assert.equal(updated?.status, 'running')
  assert.equal(updated?.observations.length, 1)
})

test('records assistant decisions and write-back observations in loop state', () => {
  const manager = new TaskSessionManager()
  const session = manager.create({
    prompt: 'Read package.json',
    mode: 'auto',
    provider: {
      id: 'lmstudio',
      name: 'LMStudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: '',
      model: 'qwen3',
      apiType: 'openai',
      enabled: true,
    },
    mcpServers: [],
  })

  manager.recordAssistantDecision(session.id, {
    type: 'call_tool',
    summary: 'Read package metadata',
    toolName: 'filesystem.read_file',
  })
  manager.recordObservationWriteBack(session.id, {
    type: 'tool_result',
    actionId: 'tool-1',
    name: 'filesystem.read_file',
    status: 'success',
    summary: 'Read package metadata',
    data: { result: { text: '{"name":"ai-box"}' } },
    rawExcerpt: '{"name":"ai-box"}',
    artifacts: [],
  })

  const updated = manager.get(session.id)

  assert.equal(updated?.loop.turnCount, 2)
  assert.equal(updated?.loop.transitionReason, 'tool_result')
  assert.equal(updated?.loop.messages.length, 3)
  assert.equal(updated?.loop.messages[1]?.role, 'assistant')
  assert.deepEqual(updated?.loop.messages[2]?.content, [
    {
      type: 'tool_result',
      tool_use_id: 'tool-1',
      status: 'success',
      name: 'filesystem.read_file',
      summary: 'Read package metadata',
      content: '{"name":"ai-box"}',
      artifacts: [],
    },
  ])
})

test('updates structured planning state with one active item', () => {
  const manager = new TaskSessionManager()
  const session = manager.create({
    prompt: 'Implement a feature',
    mode: 'auto',
    provider: {
      id: 'lmstudio',
      name: 'LMStudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: '',
      model: 'qwen3',
      apiType: 'openai',
      enabled: true,
    },
    mcpServers: [],
  })

  manager.incrementPlanningStaleness(session.id)
  const planning = manager.updatePlanning(session.id, [
    {
      content: 'Inspect current Agent runtime',
      status: 'completed',
    },
    {
      content: 'Add todo state',
      status: 'in_progress',
      activeForm: 'Adding todo state',
    },
    {
      content: 'Run verification',
      status: 'pending',
    },
  ])

  assert.equal(planning.roundsSinceUpdate, 0)
  assert.deepEqual(planning.items, [
    {
      content: 'Inspect current Agent runtime',
      status: 'completed',
    },
    {
      content: 'Add todo state',
      status: 'in_progress',
      activeForm: 'Adding todo state',
    },
    {
      content: 'Run verification',
      status: 'pending',
    },
  ])
  assert.throws(
    () =>
      manager.updatePlanning(session.id, [
        { content: 'First active', status: 'in_progress' },
        { content: 'Second active', status: 'in_progress' },
      ]),
    /at most one in_progress/
  )
})

test('proactive compaction preserves first and last two messages', () => {
  const manager = new TaskSessionManager()
  const session = manager.create({
    prompt: 'Test compaction',
    mode: 'auto',
    provider: {
      id: 'lmstudio',
      name: 'LMStudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: '',
      model: 'qwen3',
      apiType: 'openai',
      enabled: true,
    },
    mcpServers: [],
  })

  // Add 5 more messages to have 6 total (first + 5 more)
  manager.recordAssistantDecision(session.id, { type: 'call_tool', toolName: 'tool1', summary: 'step1' })
  manager.recordObservationWriteBack(session.id, {
    type: 'tool_result',
    actionId: 'tool1',
    name: 'tool1',
    status: 'success',
    summary: 'step1',
    data: {},
    rawExcerpt: 'result1',
    artifacts: [],
  })
  manager.recordAssistantDecision(session.id, { type: 'call_tool', toolName: 'tool2', summary: 'step2' })
  manager.recordObservationWriteBack(session.id, {
    type: 'tool_result',
    actionId: 'tool2',
    name: 'tool2',
    status: 'success',
    summary: 'step2',
    data: {},
    rawExcerpt: 'result2',
    artifacts: [],
  })
  manager.recordAssistantDecision(session.id, { type: 'call_tool', toolName: 'tool3', summary: 'step3' })
  manager.recordObservationWriteBack(session.id, {
    type: 'tool_result',
    actionId: 'tool3',
    name: 'tool3',
    status: 'success',
    summary: 'step3',
    data: {},
    rawExcerpt: 'result3',
    artifacts: [],
  })

  const beforeCount = manager.get(session.id)?.loop.messages.length
  assert.equal(beforeCount, 7)

  manager.compactLoopProactive(session.id, 'too long')
  const after = manager.get(session.id)

  assert.equal(after?.loop.messages.length, 4)
  assert.equal(after?.loop.messages[0]?.role, 'user')
  assert.match(String(after?.loop.messages[1]?.content), /proactive compaction/)
  assert.equal(after?.loop.messages[2]?.role, 'assistant')
  assert.equal(after?.loop.messages[3]?.role, 'user')
  assert.equal(after?.loop.compactionCount, 1)
})

test('cleanup removes oldest completed sessions exceeding max', () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-sessions-'))
  const manager = new TaskSessionManager({
    maxSessions: 3,
    cleanupAgeMs: 0,
    sessionsRoot: root,
  })

  // Create 5 completed sessions with distinct past timestamps
  const ids: string[] = []
  const baseTime = Date.now()
  for (let i = 0; i < 5; i++) {
    const session = manager.create({
      prompt: `task ${i}`,
      mode: 'auto',
      provider: {
        id: 'lmstudio',
        name: 'LMStudio',
        baseURL: 'http://127.0.0.1:1234/v1',
        apiKey: '',
        model: 'qwen3',
        apiType: 'openai',
        enabled: true,
      },
      mcpServers: [],
    })
    // Force distinct lastActivity by manipulating the creation event timestamp (past)
    const pastTime = baseTime - (5 - i) * 1000
    session.events[0]!.timestamp = pastTime
    session.loop.messages[0]!.timestamp = pastTime
    ids.push(session.id)
    // Simulate completion by rejecting
    manager.reject(session.id)
  }

  // Create a new session to trigger cleanup
  manager.create({
    prompt: 'trigger',
    mode: 'auto',
    provider: {
      id: 'lmstudio',
      name: 'LMStudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: '',
      model: 'qwen3',
      apiType: 'openai',
      enabled: true,
    },
    mcpServers: [],
  })

  // Remove 3 oldest to get down to maxSessions=3 (ids[3], ids[4], trigger)
  assert.equal(manager.get(ids[0]), undefined)
  assert.equal(manager.get(ids[1]), undefined)
  assert.equal(manager.get(ids[2]), undefined)
  assert.ok(manager.get(ids[3]))
  assert.ok(manager.get(ids[4]))

  rmSync(root, { recursive: true })
})

test('cleanup never removes running sessions', () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-sessions-'))
  const manager = new TaskSessionManager({
    maxSessions: 2,
    cleanupAgeMs: 0,
    sessionsRoot: root,
  })

  const baseTime = Date.now()

  const running = manager.create({
    prompt: 'running',
    mode: 'auto',
    provider: {
      id: 'lmstudio',
      name: 'LMStudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: '',
      model: 'qwen3',
      apiType: 'openai',
      enabled: true,
    },
    mcpServers: [],
  })

  const completed = manager.create({
    prompt: 'completed',
    mode: 'auto',
    provider: {
      id: 'lmstudio',
      name: 'LMStudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: '',
      model: 'qwen3',
      apiType: 'openai',
      enabled: true,
    },
    mcpServers: [],
  })
  completed.events[0]!.timestamp = baseTime - 2000
  completed.loop.messages[0]!.timestamp = baseTime - 2000
  manager.reject(completed.id)

  // Create another completed session to trigger cleanup
  const another = manager.create({
    prompt: 'another',
    mode: 'auto',
    provider: {
      id: 'lmstudio',
      name: 'LMStudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: '',
      model: 'qwen3',
      apiType: 'openai',
      enabled: true,
    },
    mcpServers: [],
  })
  another.events[0]!.timestamp = baseTime - 1000
  another.loop.messages[0]!.timestamp = baseTime - 1000
  manager.reject(another.id)

  assert.ok(manager.get(running.id))
  assert.equal(manager.get(completed.id), undefined)

  rmSync(root, { recursive: true })
})

test('persist and load sessions', () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-sessions-'))

  // Create and persist a completed session
  const manager1 = new TaskSessionManager({ sessionsRoot: root })
  const session = manager1.create({
    prompt: 'persist me',
    mode: 'auto',
    provider: {
      id: 'lmstudio',
      name: 'LMStudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: '',
      model: 'qwen3',
      apiType: 'openai',
      enabled: true,
    },
    mcpServers: [],
  })
  manager1.reject(session.id)

  // Load in a new manager instance
  const manager2 = new TaskSessionManager({ sessionsRoot: root })
  const loaded = manager2.get(session.id)

  assert.ok(loaded)
  assert.equal(loaded?.prompt, 'persist me')
  assert.equal(loaded?.status, 'rejected')

  rmSync(root, { recursive: true })
})

test('running sessions are marked failed on load', () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-sessions-'))

  const manager1 = new TaskSessionManager({ sessionsRoot: root })
  const session = manager1.create({
    prompt: 'running task',
    mode: 'auto',
    provider: {
      id: 'lmstudio',
      name: 'LMStudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: '',
      model: 'qwen3',
      apiType: 'openai',
      enabled: true,
    },
    mcpServers: [],
  })
  // Do not finalize - simulate abrupt shutdown
  manager1['persistSession'](session)

  const manager2 = new TaskSessionManager({ sessionsRoot: root })
  const loaded = manager2.get(session.id)

  assert.equal(loaded?.status, 'failed')
  const failedEvent = loaded?.events.find((e) => e.type === 'task.failed')
  assert.ok(failedEvent)
  assert.match(
    (failedEvent?.payload as { message?: string })?.message ?? '',
    /Interrupted by app restart/
  )

  rmSync(root, { recursive: true })
})

test('finalize persists completed and failed sessions only', () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-sessions-'))
  const manager = new TaskSessionManager({ sessionsRoot: root })

  const running = manager.create({
    prompt: 'running',
    mode: 'auto',
    provider: {
      id: 'lmstudio',
      name: 'LMStudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: '',
      model: 'qwen3',
      apiType: 'openai',
      enabled: true,
    },
    mcpServers: [],
  })

  manager.finalize(running.id)

  // Running sessions should not be persisted
  const manager2 = new TaskSessionManager({ sessionsRoot: root })
  assert.equal(manager2.get(running.id), undefined)

  rmSync(root, { recursive: true })
})
