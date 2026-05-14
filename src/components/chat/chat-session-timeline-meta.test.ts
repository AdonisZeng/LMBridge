import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getAgentOriginBadge,
  getSourceItems,
} from './chat-session-timeline-meta.ts'

test('source items expose rag labels and web links', () => {
  const items = getSourceItems({
    sources: [
      { id: 'doc-a', name: 'alpha.md', provider: 'rag' },
      {
        id: 'web-1',
        name: 'Release Notes',
        url: 'https://example.com/release',
        snippet: 'Release snippet',
        provider: 'web',
      },
    ],
  })

  assert.deepEqual(items, [
    {
      id: 'doc-a',
      label: 'alpha.md',
      url: undefined,
      title: 'alpha.md',
    },
    {
      id: 'web-1',
      label: 'Release Notes',
      url: 'https://example.com/release',
      title: 'Release snippet',
    },
  ])
})

test('agent badge only appears for agent messages', () => {
  assert.equal(
    getAgentOriginBadge({ origin: 'agent' }),
    'Agent'
  )
  assert.equal(
    getAgentOriginBadge({ origin: 'web' }),
    null
  )
})
