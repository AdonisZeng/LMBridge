import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { RecoveryController } from './recovery-controller.ts'

test('asks for continuation on truncated model output until the continuation budget is used', () => {
  const controller = new RecoveryController({ maxContinuationAttempts: 1 })
  const state = controller.createState()

  const first = controller.choose({ stopReason: 'max_tokens', state })
  const second = controller.choose({ stopReason: 'max_tokens', state })

  assert.equal(first.kind, 'continue')
  assert.equal(second.kind, 'fail')
  assert.equal(state.continuationAttempts, 1)
})

test('compacts context on prompt-length failures and backs off on transient provider errors', () => {
  const controller = new RecoveryController({
    maxCompactionAttempts: 1,
    maxTransportAttempts: 1,
  })
  const state = controller.createState()

  const compact = controller.choose({
    error: new Error('context length exceeded'),
    state,
  })
  const backoff = controller.choose({
    error: new Error('rate limit reached'),
    state,
  })
  const exhausted = controller.choose({
    error: new Error('rate limit reached'),
    state,
  })

  assert.equal(compact.kind, 'compact')
  assert.equal(backoff.kind, 'backoff')
  assert.equal(exhausted.kind, 'fail')
})
