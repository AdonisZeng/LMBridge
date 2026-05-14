import * as assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { ScheduleStore } from './schedule-store.ts'

test('creates interval schedules and reports due notifications once per check', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-schedule-'))
  const store = new ScheduleStore(root)
  const start = Date.parse('2026-04-23T10:00:00.000Z')

  const schedule = await store.create({
    name: 'Review background task',
    prompt: 'Check whether the background task finished.',
    everyMinutes: 15,
    startAt: start,
  })
  const firstDue = await store.checkDue(start)
  const secondDue = await store.checkDue(start)

  assert.equal(schedule.nextRunAt, start)
  assert.deepEqual(firstDue.map((item) => item.scheduleId), [schedule.id])
  assert.deepEqual(secondDue, [])
  assert.equal((await store.get(schedule.id))?.nextRunAt, start + 15 * 60_000)
})

test('lists active schedules after reloading from disk', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-schedule-'))
  const store = new ScheduleStore(root)
  await store.create({
    name: 'Daily check',
    prompt: 'Check project health.',
    everyMinutes: 60,
    startAt: Date.parse('2026-04-23T10:00:00.000Z'),
  })

  const reloaded = new ScheduleStore(root)

  assert.equal((await reloaded.list()).length, 1)
  assert.equal((await reloaded.list())[0]?.status, 'active')
})
