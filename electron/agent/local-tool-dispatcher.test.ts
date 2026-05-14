import * as assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { LocalToolDispatcher } from './local-tool-dispatcher.ts'

test('lists controlled local file tools', () => {
  const dispatcher = new LocalToolDispatcher({ rootDir: process.cwd() })
  const names = dispatcher.listTools().map((tool) => tool.name)

  assert.deepEqual(names, ['local.read_file', 'local.write_file', 'local.edit_file'])
})

test('reads, writes, and edits files inside the local root', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-local-tools-'))
  mkdirSync(join(root, 'docs'))
  writeFileSync(join(root, 'docs', 'note.md'), 'hello agent')
  const dispatcher = new LocalToolDispatcher({ rootDir: root })

  const readResult = await dispatcher.callTool('local.read_file', {
    path: 'docs/note.md',
  })
  assert.deepEqual(readResult, {
    path: 'docs/note.md',
    content: 'hello agent',
  })

  const writeResult = await dispatcher.callTool('local.write_file', {
    path: 'docs/output.md',
    content: 'draft',
  })
  assert.deepEqual(writeResult, {
    path: 'docs/output.md',
    bytes: 5,
  })

  const editResult = await dispatcher.callTool('local.edit_file', {
    path: 'docs/output.md',
    oldText: 'draft',
    newText: 'final',
  })
  assert.deepEqual(editResult, {
    path: 'docs/output.md',
    replacements: 1,
  })
  assert.equal(readFileSync(join(root, 'docs', 'output.md'), 'utf8'), 'final')
})

test('rejects local tool paths outside the configured root', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-local-tools-'))
  const dispatcher = new LocalToolDispatcher({ rootDir: root })

  await assert.rejects(
    () => dispatcher.callTool('local.read_file', { path: '../secret.txt' }),
    /outside the local tool root/
  )
})
