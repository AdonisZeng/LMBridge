import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApprovalGate } from './approval-gate.ts'

test('allows external actions in auto mode', () => {
  const gate = new ApprovalGate()

  const result = gate.evaluate('auto', {
    type: 'call_tool',
    toolName: 'filesystem.read_file',
  })

  assert.equal(result.requiresApproval, false)
})

test('blocks tool calls in confirm-external mode', () => {
  const gate = new ApprovalGate()

  const result = gate.evaluate('confirm-external', {
    type: 'call_tool',
    toolName: 'filesystem.read_file',
  })

  assert.equal(result.requiresApproval, true)
  assert.equal(result.request?.title, 'Call filesystem.read_file')
})

test('blocks executable skill use in confirm-external mode', () => {
  const gate = new ApprovalGate()

  const result = gate.evaluate('confirm-external', {
    type: 'use_skill',
    skillId: 'repo-summary',
  })

  assert.equal(result.requiresApproval, true)
  assert.equal(result.request?.title, 'Run Skill repo-summary')
})

test('applies deny rules before mode or allow rules', () => {
  const gate = new ApprovalGate({
    rules: [
      { tool: 'local.write_file', behavior: 'allow' },
      { tool: 'local.write_file', behavior: 'deny', path: 'secrets/*' },
    ],
  })

  const result = gate.evaluate('auto', {
    type: 'call_tool',
    toolName: 'local.write_file',
    arguments: { path: 'secrets/token.txt' },
  })

  assert.equal(result.behavior, 'deny')
  assert.equal(result.requiresApproval, false)
  assert.match(result.reason, /deny rule/)
})

test('allows explicit safe rules in confirm-external mode before asking', () => {
  const gate = new ApprovalGate({
    rules: [{ tool: 'local.read_file', behavior: 'allow', path: 'src/*' }],
  })

  const allowed = gate.evaluate('confirm-external', {
    type: 'call_tool',
    toolName: 'local.read_file',
    arguments: { path: 'src/index.ts' },
  })
  const asked = gate.evaluate('confirm-external', {
    type: 'call_tool',
    toolName: 'local.read_file',
    arguments: { path: 'package.json' },
  })

  assert.equal(allowed.behavior, 'allow')
  assert.equal(allowed.requiresApproval, false)
  assert.equal(asked.behavior, 'ask')
  assert.equal(asked.requiresApproval, true)
})
