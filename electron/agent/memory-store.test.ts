import * as assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { MemoryStore } from './memory-store.ts'

test('saves memory entries as markdown and refreshes the memory index', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-memory-'))
  const store = new MemoryStore(root)

  const saved = await store.save({
    name: 'Prefer concise answers',
    type: 'user',
    description: 'User prefers concise Chinese responses.',
    content: 'Keep answers concise unless the task needs a deeper walkthrough.',
  })
  const entries = await store.list()

  assert.equal(saved.id, 'prefer-concise-answers')
  assert.equal(entries.length, 1)
  assert.equal(entries[0]?.name, 'Prefer concise answers')
  assert.equal(entries[0]?.content, 'Keep answers concise unless the task needs a deeper walkthrough.')
  assert.match(readFileSync(join(root, 'MEMORY.md'), 'utf8'), /prefer-concise-answers/)
})

test('rejects secret-like memory content', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-memory-'))
  const store = new MemoryStore(root)

  await assert.rejects(
    () =>
      store.save({
        name: 'API token',
        type: 'project',
        description: 'Do not save this.',
        content: 'OPENAI_API_KEY=sk-test',
      }),
    /secret/i
  )
})
