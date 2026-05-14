import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { SETTINGS_SECTIONS } from './settings-sections.ts'

test('settings sections include provider, mcp, knowledge base, and web search', () => {
  assert.deepEqual(
    SETTINGS_SECTIONS.map((section) => section.id),
    ['provider', 'mcp', 'knowledge-base', 'web-search']
  )
  assert.deepEqual(
    SETTINGS_SECTIONS.map((section) => section.label),
    ['提供商', 'MCP', '知识库', '联网搜索']
  )
})
