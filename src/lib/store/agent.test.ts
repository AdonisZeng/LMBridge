import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAgentStore } from './agent.ts'

test('records plan, tool traces, and final result from task events', () => {
  const store = createAgentStore()

  store.getState().applyEvent({
    type: 'plan.generated',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      steps: ['Read package.json', 'Summarize findings'],
    },
  })
  store.getState().applyEvent({
    type: 'skill.selected',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      skillId: 'repo-summary',
    },
  })
  store.getState().applyEvent({
    type: 'tool.call.started',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      name: 'filesystem.read_file',
      arguments: { path: 'package.json' },
      summary: 'Read package metadata',
    },
  })
  store.getState().applyEvent({
    type: 'tool.call.finished',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      name: 'filesystem.read_file',
      summary: 'Read package metadata',
      result: { text: 'ok' },
    },
  })
  store.getState().applyEvent({
    type: 'script.started',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      command: 'scripts/run.py',
      runner: 'python',
    },
  })
  store.getState().applyEvent({
    type: 'script.output',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      output: 'summary-ready',
    },
  })
  store.getState().applyEvent({
    type: 'script.finished',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      command: 'scripts/run.py',
      status: 'success',
    },
  })
  store.getState().applyEvent({
    type: 'task.completed',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      finalMessage: 'Done',
    },
  })

  const state = store.getState()
  assert.deepEqual(
    state.events.map((event) => event.type),
    [
      'plan.generated',
      'skill.selected',
      'tool.call.started',
      'tool.call.finished',
      'script.started',
      'script.output',
      'script.finished',
      'task.completed',
    ]
  )
  assert.deepEqual(state.plan, ['Read package.json', 'Summarize findings'])
  assert.equal(state.selectedSkills[0], 'repo-summary')
  assert.equal(state.toolCalls[0]?.name, 'filesystem.read_file')
  assert.equal(state.toolCalls[0]?.status, 'success')
  assert.deepEqual(state.toolCalls[0]?.arguments, { path: 'package.json' })
  assert.equal(state.logs.some((entry) => entry.includes('开始调用 MCP 工具')), true)
  assert.equal(state.logs.some((entry) => entry.includes('summary-ready')), true)
  assert.equal(state.logs.some((entry) => entry.includes('脚本执行完成')), true)
  assert.equal(state.finalMessage, 'Done')
})

test('clears task events when reset', () => {
  const store = createAgentStore()

  store.getState().applyEvent({
    type: 'task.created',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      prompt: 'Inspect repo',
    },
  })

  assert.equal(store.getState().events.length, 1)

  store.getState().reset()

  assert.equal(store.getState().events.length, 0)
})

test('surfaces pending approval requests', () => {
  const store = createAgentStore()

  store.getState().applyEvent({
    type: 'approval.required',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      actionId: 'step-2',
      title: 'Call filesystem.read_file',
      details: 'Read package.json',
    },
  })

  assert.equal(store.getState().approval?.title, 'Call filesystem.read_file')
})

test('returns to running when work resumes after approval', () => {
  const store = createAgentStore()

  store.getState().applyEvent({
    type: 'approval.required',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      actionId: 'step-2',
      title: 'Call filesystem.read_file',
      details: 'Read package.json',
    },
  })
  store.getState().applyEvent({
    type: 'tool.call.started',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      name: 'filesystem.read_file',
    },
  })

  assert.equal(store.getState().status, 'running')
  assert.equal(store.getState().approval, null)
})

test('marks the task rejected from rejection events', () => {
  const store = createAgentStore()

  store.getState().applyEvent({
    type: 'approval.required',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      actionId: 'step-2',
      title: 'Call filesystem.read_file',
      details: 'Read package.json',
    },
  })
  store.getState().applyEvent({
    type: 'task.rejected',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      message: '用户拒绝了外部操作。',
    },
  })

  assert.equal(store.getState().status, 'rejected')
  assert.equal(store.getState().approval, null)
  assert.equal(
    store.getState().logs.some((entry) => entry.includes('用户拒绝了外部操作')),
    true
  )
})

test('tracks step lifecycle entries in execution logs', () => {
  const store = createAgentStore()

  store.getState().applyEvent({
    type: 'step.started',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      actionType: 'call_tool',
      summary: 'Read package.json',
    },
  })
  store.getState().applyEvent({
    type: 'step.completed',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      actionType: 'call_tool',
      summary: 'Read package.json',
    },
  })

  const logs = store.getState().logs
  assert.equal(logs.some((entry) => entry.includes('开始步骤')), true)
  assert.equal(logs.some((entry) => entry.includes('完成步骤')), true)
})

test('matches concurrent tool calls by traceId', () => {
  const store = createAgentStore()

  // Start two concurrent calls to the same tool
  store.getState().applyEvent({
    type: 'tool.call.started',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      name: 'filesystem.read_file',
      arguments: { path: 'a.txt' },
      summary: 'Read A',
      traceId: 'trace-a',
    },
  })
  store.getState().applyEvent({
    type: 'tool.call.started',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      name: 'filesystem.read_file',
      arguments: { path: 'b.txt' },
      summary: 'Read B',
      traceId: 'trace-b',
    },
  })

  // Finish the second one first (out of order)
  store.getState().applyEvent({
    type: 'tool.call.finished',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      name: 'filesystem.read_file',
      summary: 'Read B',
      result: { text: 'b-content' },
      traceId: 'trace-b',
    },
  })

  const state = store.getState()
  assert.equal(state.toolCalls.length, 2)
  assert.equal(state.toolCalls[0]?.status, 'running')
  assert.equal(state.toolCalls[0]?.traceId, 'trace-a')
  assert.equal(state.toolCalls[1]?.status, 'success')
  assert.equal(state.toolCalls[1]?.traceId, 'trace-b')
  assert.deepEqual(state.toolCalls[1]?.result, { text: 'b-content' })
})

test('falls back to name matching when traceId is absent', () => {
  const store = createAgentStore()

  store.getState().applyEvent({
    type: 'tool.call.started',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      name: 'filesystem.read_file',
      arguments: { path: 'package.json' },
    },
  })
  store.getState().applyEvent({
    type: 'tool.call.finished',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: {
      name: 'filesystem.read_file',
      result: { text: 'ok' },
    },
  })

  assert.equal(store.getState().toolCalls[0]?.status, 'success')
  assert.equal(store.getState().toolCalls[0]?.traceId, undefined)
})
