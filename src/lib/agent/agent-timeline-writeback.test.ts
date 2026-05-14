import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildAgentTimelineMessage } from './agent-timeline-writeback.ts'
import type { AgentTaskEvent } from '@/types/agent'

function createEvent(
  type: AgentTaskEvent['type'],
  payload?: Record<string, unknown>
): AgentTaskEvent {
  return {
    type,
    taskId: 'task-1',
    timestamp: 100,
    payload,
  }
}

test('maps key agent events into shared assistant timeline messages', () => {
  assert.deepEqual(buildAgentTimelineMessage(createEvent('task.created')), {
    role: 'assistant',
    content: 'Agent 已接手这条任务，正在生成计划。',
    origin: 'agent',
    tone: 'status',
  })

  assert.deepEqual(
    buildAgentTimelineMessage(
      createEvent('plan.generated', {
        steps: ['Read package.json', 'Summarize findings'],
      })
    ),
    {
      role: 'assistant',
      content: 'Agent 计划：\n1. Read package.json\n2. Summarize findings',
      origin: 'agent',
      tone: 'status',
    }
  )

  assert.deepEqual(
    buildAgentTimelineMessage(
      createEvent('approval.required', {
        title: 'Call filesystem.read_file',
        details: 'Read package.json',
      })
    ),
    {
      role: 'assistant',
      content: '需要你的确认：Call filesystem.read_file\nRead package.json',
      origin: 'agent',
      tone: 'status',
    }
  )

  assert.deepEqual(
    buildAgentTimelineMessage(
      createEvent('task.completed', {
        finalMessage: 'The provider has been configured.',
      })
    ),
    {
      role: 'assistant',
      content: 'The provider has been configured.',
      origin: 'agent',
      tone: 'success',
    }
  )

  assert.deepEqual(
    buildAgentTimelineMessage(
      createEvent('task.failed', {
        message: 'Task failed.',
      })
    ),
    {
      role: 'assistant',
      content: 'Task failed.',
      origin: 'agent',
      tone: 'error',
    }
  )

  assert.deepEqual(
    buildAgentTimelineMessage(
      createEvent('task.rejected', {
        message: 'Action rejected by user.',
      })
    ),
    {
      role: 'assistant',
      content: 'Action rejected by user.',
      origin: 'agent',
      tone: 'rejected',
    }
  )

  assert.equal(buildAgentTimelineMessage(createEvent('tool.call.started')), null)
})
