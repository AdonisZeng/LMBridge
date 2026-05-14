import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { canSwitchAgentMode } from './agent-mode.ts'

test('blocks mode switches while chat generation or active agent execution is in progress', () => {
  assert.equal(
    canSwitchAgentMode({
      currentMode: 'chat',
      nextMode: 'agent',
      isChatGenerating: true,
      agentStatus: 'idle',
    }),
    false
  )

  assert.equal(
    canSwitchAgentMode({
      currentMode: 'agent',
      nextMode: 'chat',
      isChatGenerating: false,
      agentStatus: 'running',
    }),
    false
  )

  assert.equal(
    canSwitchAgentMode({
      currentMode: 'agent',
      nextMode: 'chat',
      isChatGenerating: false,
      agentStatus: 'awaiting-approval',
    }),
    false
  )

  assert.equal(
    canSwitchAgentMode({
      currentMode: 'chat',
      nextMode: 'agent',
      isChatGenerating: false,
      agentStatus: 'idle',
    }),
    true
  )

  assert.equal(
    canSwitchAgentMode({
      currentMode: 'agent',
      nextMode: 'chat',
      isChatGenerating: false,
      agentStatus: 'completed',
    }),
    true
  )
})
