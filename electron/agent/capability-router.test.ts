import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { CapabilityRouter } from './capability-router.ts'

test('lists built-in, local, and prefixed MCP tools without losing the original schema', () => {
  const router = new CapabilityRouter()
  const tools = router.listTools({
    builtInTools: [{ name: 'agent.task_create', description: 'Create a task', inputSchema: {} }],
    externalTools: [{ name: 'local.read_file', description: 'Read local files', inputSchema: {} }],
    mcpServers: [
      {
        id: 'fs',
        name: 'Filesystem',
        url: 'http://localhost:3001',
        connected: true,
        tools: [{ name: 'read_file', description: 'Read via MCP', inputSchema: { type: 'object' } }],
      },
    ],
  })

  assert.deepEqual(
    tools.map((tool) => tool.name),
    ['agent.task_create', 'local.read_file', 'mcp__fs__read_file']
  )
  assert.deepEqual(tools[2]?.inputSchema, { type: 'object' })
})

test('resolves prefixed MCP calls back to their server and original tool name', () => {
  const router = new CapabilityRouter()
  const server = {
    id: 'fs',
    name: 'Filesystem',
    url: 'http://localhost:3001',
    connected: true,
    tools: [{ name: 'read_file', description: 'Read via MCP', inputSchema: {} }],
  }

  const route = router.resolve({
    toolName: 'mcp__fs__read_file',
    mcpServers: [server],
  })

  assert.equal(route.source, 'mcp')
  assert.equal(route.toolName, 'read_file')
  assert.equal(route.server, server)
})

test('keeps existing local and raw MCP fallback resolution behavior', () => {
  const router = new CapabilityRouter()
  const server = {
    id: 'fs',
    name: 'Filesystem',
    url: 'http://localhost:3001',
    connected: true,
    tools: [{ name: 'filesystem.read_file', description: 'Read via MCP', inputSchema: {} }],
  }

  assert.equal(router.resolve({ toolName: 'local.read_file', mcpServers: [] }).server, null)
  assert.equal(
    router.resolve({ toolName: 'filesystem.read_file', mcpServers: [server] }).server,
    server
  )
})
