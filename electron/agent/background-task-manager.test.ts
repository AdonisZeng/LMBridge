import * as assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { BackgroundTaskManager } from './background-task-manager.ts'

test('starts a background task immediately and records the eventual runner result', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-background-'))
  let resolveRun: (value: { exitCode: number; stdout: string; stderr: string }) => void = () => {}
  const manager = new BackgroundTaskManager({
    rootDir: root,
    runner: {
      run: async () =>
        new Promise((resolve) => {
          resolveRun = resolve
        }),
    },
  })

  const started = await manager.start({
    runner: 'shell',
    command: 'scripts/slow-task.sh',
    cwd: root,
    summary: 'Run slow task',
  })

  assert.equal(started.status, 'running')
  assert.equal(existsSync(started.logPath), false)

  resolveRun({ exitCode: 0, stdout: 'finished', stderr: '' })
  await new Promise((resolve) => setTimeout(resolve, 0))
  const completed = await manager.check(started.id)

  assert.equal(completed?.status, 'completed')
  assert.equal(completed?.exitCode, 0)
  assert.match(readFileSync(completed?.logPath ?? '', 'utf8'), /finished/)
})

test('persists background task records across manager instances', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-background-'))
  const manager = new BackgroundTaskManager({
    rootDir: root,
    runner: { run: async () => ({ exitCode: 1, stdout: '', stderr: 'boom' }) },
  })
  const started = await manager.start({
    runner: 'node',
    command: 'scripts/fail.js',
    cwd: root,
    summary: 'Run failing task',
  })
  await new Promise((resolve) => setTimeout(resolve, 0))

  const reloaded = new BackgroundTaskManager({
    rootDir: root,
    runner: { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
  })
  const failed = await reloaded.check(started.id)

  assert.equal(failed?.status, 'failed')
  assert.equal(failed?.stderr, 'boom')
})
