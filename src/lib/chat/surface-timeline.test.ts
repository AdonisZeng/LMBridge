import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { scrollSurfaceTimelineToBottom } from './surface-timeline.ts'

test('scrolls only the active chat surface container vertically', () => {
  const chatContainer = { scrollTop: 0, scrollHeight: 240 }
  const agentContainer = { scrollTop: 18, scrollHeight: 640 }

  scrollSurfaceTimelineToBottom({
    surfaceMode: 'chat',
    chatTimelineContainerRef: { current: chatContainer },
    agentTimelineContainerRef: { current: agentContainer },
  })

  assert.equal(chatContainer.scrollTop, 240)
  assert.equal(agentContainer.scrollTop, 18)
})

test('scrolls only the active agent surface container vertically', () => {
  const chatContainer = { scrollTop: 12, scrollHeight: 240 }
  const agentContainer = { scrollTop: 0, scrollHeight: 640 }

  scrollSurfaceTimelineToBottom({
    surfaceMode: 'agent',
    chatTimelineContainerRef: { current: chatContainer },
    agentTimelineContainerRef: { current: agentContainer },
  })

  assert.equal(chatContainer.scrollTop, 12)
  assert.equal(agentContainer.scrollTop, 640)
})
