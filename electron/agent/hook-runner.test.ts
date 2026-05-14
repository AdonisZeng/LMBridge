import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { HookRunner } from './hook-runner.ts'

test('returns allow when no hooks are registered for an event', async () => {
  const runner = new HookRunner()

  const result = await runner.run('PreToolUse', {
    toolName: 'local.read_file',
    arguments: { path: 'package.json' },
  })

  assert.deepEqual(result, { exitCode: 0, message: '' })
})

test('stops at the first blocking hook result', async () => {
  const calls: string[] = []
  const runner = new HookRunner()
  runner.register('PreToolUse', () => {
    calls.push('first')
    return { exitCode: 0, message: '' }
  })
  runner.register('PreToolUse', () => {
    calls.push('second')
    return { exitCode: 2, message: 'Inject this warning into the agent loop.' }
  })
  runner.register('PreToolUse', () => {
    calls.push('third')
    return { exitCode: 1, message: 'This should not run.' }
  })

  const result = await runner.run('PreToolUse', {
    toolName: 'local.write_file',
    arguments: { path: 'README.md' },
  })

  assert.deepEqual(calls, ['first', 'second'])
  assert.deepEqual(result, {
    exitCode: 2,
    message: 'Inject this warning into the agent loop.',
  })
})

test('supports asynchronous hook handlers', async () => {
  const runner = new HookRunner()
  runner.register('SessionStart', async () => ({ exitCode: 0, message: 'ready' }))

  const result = await runner.run('SessionStart', { taskId: 'task-1' })

  assert.deepEqual(result, { exitCode: 0, message: 'ready' })
})
