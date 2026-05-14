import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { registerRagIpc } from './ipc.ts'
import type { RagIndexRequest, RagQueryRequest } from './types.ts'

type IpcHandler = (...args: unknown[]) => unknown

function createHandlers() {
  const handlers = new Map<string, IpcHandler>()
  registerRagIpc(
    {
      handle(channel: string, handler: IpcHandler) {
        handlers.set(channel, handler)
      },
    },
    {
      async listSources() {
        return []
      },
      async removeSource() {
        return []
      },
      async clearSources() {
        return []
      },
      async indexFiles(request: RagIndexRequest) {
        return { sources: [], indexedChunks: request.filePaths.length }
      },
      async query(request: RagQueryRequest) {
        return { answer: request.question, matches: [] }
      },
    },
    {
      dialog: {
        async showOpenDialog() {
          return {
            canceled: false,
            filePaths: ['D:\\Docs\\one.md'],
          }
        },
      },
    }
  )
  return handlers
}

test('registers RAG IPC handlers', () => {
  const handlers = createHandlers()

  assert.deepEqual([...handlers.keys()].sort(), [
    'rag:clear-sources',
    'rag:index-files',
    'rag:list-sources',
    'rag:query',
    'rag:remove-source',
    'rag:select-files',
  ])
})

test('select files returns the dialog file paths', async () => {
  const handlers = createHandlers()
  const result = await handlers.get('rag:select-files')?.({})

  assert.deepEqual(result, ['D:\\Docs\\one.md'])
})

test('index and query delegate to the RAG service', async () => {
  const handlers = createHandlers()
  const indexResult = await handlers.get('rag:index-files')?.({}, {
    filePaths: ['one.md', 'two.md'],
  })
  const queryResult = await handlers.get('rag:query')?.({}, {
    question: 'hello',
  })

  assert.deepEqual(indexResult, { sources: [], indexedChunks: 2 })
  assert.deepEqual(queryResult, { answer: 'hello', matches: [] })
})

test('remove and clear delegate to the RAG service', async () => {
  const handlers = createHandlers()
  const removeResult = await handlers.get('rag:remove-source')?.({}, 'doc-a')
  const clearResult = await handlers.get('rag:clear-sources')?.({})

  assert.deepEqual(removeResult, [])
  assert.deepEqual(clearResult, [])
})
