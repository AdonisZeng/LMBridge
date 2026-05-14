import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { registerAgentIpc } from './ipc.ts'

type IpcHandler = (...args: unknown[]) => unknown

test('registers the expected agent IPC handlers', () => {
  const handlers = new Map<string, IpcHandler>()
  const ipcMainLike = {
    handle(channel: string, fn: IpcHandler) {
      handlers.set(channel, fn)
    },
  }

  registerAgentIpc(
    ipcMainLike as never,
    {
      start: async () => null,
      getTaskState: () => null,
      approveAction: async () => null,
      rejectAction: () => null,
      cancelTask: () => null,
      onTaskEvent: () => () => undefined,
    } as never
  )

  assert.deepEqual([...handlers.keys()].sort(), [
    'agent:approve-action',
    'agent:cancel-task',
    'agent:get-task-state',
    'agent:reject-action',
    'agent:start-task',
  ])
})

test('forwards runtime task events to the renderer bridge', () => {
  let forwardTaskEvent: ((event: unknown) => void) | null = null
  const forwarded: Array<{ channel: string; payload: unknown }> = []

  registerAgentIpc(
    {
      handle() {
        return undefined
      },
    } as never,
    {
      start: async () => null,
      getTaskState: () => null,
      approveAction: async () => null,
      rejectAction: () => null,
      cancelTask: () => null,
      onTaskEvent(listener: (event: unknown) => void) {
        forwardTaskEvent = listener
        return () => undefined
      },
    } as never,
    {
      sendEvent: (channel, payload) => {
        forwarded.push({ channel, payload })
      },
    }
  )

  forwardTaskEvent?.({
    type: 'task.completed',
    taskId: 'task-1',
    timestamp: Date.now(),
    payload: { finalMessage: 'Done' },
  })

  assert.equal(forwarded.length, 1)
  assert.equal(forwarded[0]?.channel, 'agent:task-event')
})
