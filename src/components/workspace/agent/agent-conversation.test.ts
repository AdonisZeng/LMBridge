import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AgentApprovalRequest, AgentTaskEvent } from '@/types/agent'
import { buildAgentConversationItems } from './agent-conversation.ts'

function event(
  type: AgentTaskEvent['type'],
  payload?: Record<string, unknown>,
  timestamp = Date.now()
): AgentTaskEvent {
  return {
    type,
    taskId: 'task-1',
    timestamp,
    payload,
  }
}

test('builds a chat-first timeline from agent execution events', () => {
  const items = buildAgentConversationItems({
    events: [
      event('task.created', { prompt: 'Inspect package.json' }, 1),
      event('plan.generated', { steps: ['Read package.json', 'Summarize it'] }, 2),
      event(
        'tool.call.started',
        {
          name: 'filesystem.read_file',
          arguments: { path: 'package.json' },
          summary: 'Read package metadata',
        },
        3
      ),
      event(
        'tool.call.finished',
        {
          name: 'filesystem.read_file',
          result: { text: 'ok' },
          summary: 'Read package metadata',
          status: 'success',
        },
        4
      ),
      event('skill.selected', { skillId: 'repo-summary', name: 'Repo Summary' }, 5),
      event('script.started', { skillId: 'repo-summary', command: 'scripts/run.py' }, 6),
      event('script.output', { output: 'summary-ready' }, 7),
      event('script.finished', { skillId: 'repo-summary', status: 'success' }, 8),
      event('task.completed', { finalMessage: 'Done' }, 9),
    ],
    approval: null,
  })

  assert.deepEqual(
    items.map((item) => item.type),
    ['user', 'plan', 'tool', 'skill', 'script', 'assistant']
  )
  assert.equal(items[0]?.type, 'user')
  assert.equal(items[0]?.content, 'Inspect package.json')

  const tool = items.find((item) => item.type === 'tool')
  assert.equal(tool?.name, 'filesystem.read_file')
  assert.equal(tool?.status, 'success')
  assert.deepEqual(tool?.arguments, { path: 'package.json' })
  assert.deepEqual(tool?.result, { text: 'ok' })

  const script = items.find((item) => item.type === 'script')
  assert.equal(script?.label, 'Skill repo-summary')
  assert.deepEqual(script?.output, ['summary-ready'])
  assert.equal(script?.status, 'success')

  const finalMessage = items.find((item) => item.type === 'assistant')
  assert.equal(finalMessage?.content, 'Done')
  assert.equal(finalMessage?.tone, 'success')
})

test('adds the pending approval card only while an approval is active', () => {
  const approval: AgentApprovalRequest = {
    actionId: 'step-1',
    title: 'Call filesystem.read_file',
    details: 'Read package.json',
  }

  const items = buildAgentConversationItems({
    events: [
      event('task.created', { prompt: 'Read a file' }, 1),
      event('approval.required', { ...approval }, 2),
    ],
    approval,
  })

  const pendingApproval = items.find((item) => item.type === 'approval')
  assert.equal(pendingApproval?.title, 'Call filesystem.read_file')
  assert.equal(pendingApproval?.actionId, 'step-1')

  const resolvedItems = buildAgentConversationItems({
    events: [
      event('task.created', { prompt: 'Read a file' }, 1),
      event('approval.required', { ...approval }, 2),
      event('task.completed', { finalMessage: 'Approved' }, 3),
    ],
    approval: null,
  })

  assert.equal(resolvedItems.some((item) => item.type === 'approval'), false)
})

test('renders rejected task events as assistant feedback', () => {
  const items = buildAgentConversationItems({
    events: [
      event('task.created', { prompt: 'Read a file' }, 1),
      event('task.rejected', { message: '用户拒绝了外部操作。' }, 2),
    ],
    approval: null,
  })

  const rejected = items.find((item) => item.type === 'assistant')
  assert.equal(rejected?.tone, 'rejected')
  assert.equal(rejected?.content, '用户拒绝了外部操作。')
})

test('renders due schedule notifications as assistant feedback', () => {
  const items = buildAgentConversationItems({
    events: [
      event('task.created', { prompt: 'Check schedules' }, 1),
      event(
        'schedule.due',
        {
          name: 'Check background task',
          prompt: 'Check if the background task finished.',
        },
        2
      ),
    ],
    approval: null,
  })

  const notification = items.find((item) => item.type === 'assistant')
  assert.equal(notification?.tone, 'success')
  assert.match(notification?.content ?? '', /Check background task/)
  assert.match(notification?.content ?? '', /Check if the background task finished/)
})
