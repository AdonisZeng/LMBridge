import * as assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { RunnerManager, RunnerSecurityError } from './runner-manager.ts'

test('executes a node entrypoint and captures stdout', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-runner-'))
  const script = join(root, 'echo.mjs')
  writeFileSync(script, `console.log('runner-ok')\n`)

  const runner = new RunnerManager()
  const result = await runner.run({
    runner: 'node',
    command: script,
    cwd: root,
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /runner-ok/)
})

test('resolves shell and python commands without executing them', () => {
  const runner = new RunnerManager()

  assert.equal(runner.resolveCommand('python', 'scripts/run.py').command, 'python')
  assert.ok(runner.resolveCommand('shell', 'scripts/run.sh').command.length > 0)
})

test('resolves windows shell commands by file extension', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
  Object.defineProperty(process, 'platform', { value: 'win32' })

  try {
    const runner = new RunnerManager()

    assert.deepEqual(runner.resolveCommand('shell', 'script.ps1'), {
      command: 'powershell',
      args: ['-File', 'script.ps1'],
    })
    assert.deepEqual(runner.resolveCommand('shell', 'script.bat'), {
      command: 'cmd',
      args: ['/c', 'script.bat'],
    })
    assert.deepEqual(runner.resolveCommand('shell', 'script.cmd'), {
      command: 'cmd',
      args: ['/c', 'script.cmd'],
    })
    assert.deepEqual(runner.resolveCommand('shell', 'script.sh'), {
      command: 'cmd',
      args: ['/c', 'script.sh'],
    })
  } finally {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform)
    }
  }
})

test('blocks dangerous rm -rf commands', async () => {
  const runner = new RunnerManager([resolve(process.cwd())])

  await assert.rejects(
    () => runner.run({ runner: 'shell', command: 'rm -rf /', cwd: process.cwd() }),
    (err: Error) => err instanceof RunnerSecurityError && err.message.includes('blocked by security')
  )

  await assert.rejects(
    () => runner.run({ runner: 'shell', command: 'rm -rf ~/documents', cwd: process.cwd() }),
    (err: Error) => err instanceof RunnerSecurityError
  )
})

test('blocks format and mkfs commands', async () => {
  const runner = new RunnerManager([resolve(process.cwd())])

  await assert.rejects(
    () => runner.run({ runner: 'shell', command: 'format C:', cwd: process.cwd() }),
    (err: Error) => err instanceof RunnerSecurityError
  )

  await assert.rejects(
    () => runner.run({ runner: 'shell', command: 'mkfs.ext4 /dev/sda1', cwd: process.cwd() }),
    (err: Error) => err instanceof RunnerSecurityError
  )
})

test('blocks dd to device commands', async () => {
  const runner = new RunnerManager([resolve(process.cwd())])

  await assert.rejects(
    () =>
      runner.run({
        runner: 'shell',
        command: 'dd if=/dev/zero of=/dev/sda',
        cwd: process.cwd(),
      }),
    (err: Error) => err instanceof RunnerSecurityError
  )
})

test('rejects cwd outside allowed roots', async () => {
  const runner = new RunnerManager([resolve(process.cwd())])

  await assert.rejects(
    () =>
      runner.run({
        runner: 'node',
        command: 'script.js',
        cwd: '/tmp',
      }),
    (err: Error) =>
      err instanceof RunnerSecurityError &&
      err.message.includes('Working directory not allowed')
  )
})

test('allows cwd within allowed roots', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-runner-'))
  const runner = new RunnerManager([resolve(root)])
  const script = join(root, 'echo.mjs')
  writeFileSync(script, `console.log('runner-ok')\n`)

  const result = await runner.run({
    runner: 'node',
    command: script,
    cwd: root,
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /runner-ok/)
})
