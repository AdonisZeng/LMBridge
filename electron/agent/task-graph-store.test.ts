import * as assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { TaskGraphStore } from './task-graph-store.ts'

test('creates persistent graph tasks and marks blocked tasks as not ready', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-task-graph-'))
  const store = new TaskGraphStore(root)

  const first = await store.create({
    title: 'Inspect runtime',
    description: 'Understand current Agent runtime.',
  })
  const second = await store.create({
    title: 'Implement final runtime tools',
    description: 'Add task, background, schedule, and capability routing.',
    blockedBy: [first.id],
  })
  const reloaded = new TaskGraphStore(root)

  assert.equal(first.ready, true)
  assert.equal(second.ready, false)
  assert.deepEqual((await reloaded.list()).map((task) => task.id), [first.id, second.id])
  assert.deepEqual((await reloaded.list({ readyOnly: true })).map((task) => task.id), [first.id])
})

test('unblocks dependent tasks when blockers are completed', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-task-graph-'))
  const store = new TaskGraphStore(root)
  const blocker = await store.create({ title: 'Write tests', description: 'Write red tests.' })
  const blocked = await store.create({
    title: 'Implement code',
    description: 'Make tests pass.',
    blockedBy: [blocker.id],
  })

  await store.update(blocker.id, { status: 'done' })
  const ready = await store.get(blocked.id)

  assert.equal(ready?.ready, true)
  assert.deepEqual(ready?.blockedBy, [blocker.id])
})
