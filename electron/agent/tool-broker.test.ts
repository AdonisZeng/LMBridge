import * as assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { ToolBroker } from './tool-broker.ts'

test('lists tools from injected MCP clients', async () => {
  const root = process.cwd()
  const broker = new ToolBroker({
    localRootDir: root,
    clientFactory: () => ({
      connect: async () => undefined,
      disconnect: async () => undefined,
      isConnected: () => true,
      getServer: () => ({
        id: 'fs',
        name: 'Filesystem',
        url: 'http://localhost:3001',
        connected: true,
        tools: [
          {
            name: 'filesystem.read_file',
            description: 'Read a file',
            inputSchema: {},
          },
        ],
      }),
      callTool: async () => ({ tool: 'filesystem.read_file', result: { text: 'ok' } }),
    }),
  })

  const tools = await broker.listTools([
    { id: 'fs', name: 'Filesystem', url: 'http://localhost:3001', connected: true, tools: [] },
  ])

  assert.equal(tools.some((tool) => tool.name === 'local.read_file'), true)
  assert.equal(tools.some((tool) => tool.name === 'filesystem.read_file'), true)
})

test('normalizes tool call errors', async () => {
  const broker = new ToolBroker({
    clientFactory: () => ({
      connect: async () => undefined,
      disconnect: async () => undefined,
      isConnected: () => true,
      getServer: () => ({
        id: 'fs',
        name: 'Filesystem',
        url: 'http://localhost:3001',
        connected: true,
        tools: [],
      }),
      callTool: async () => ({ tool: 'filesystem.read_file', result: null, error: 'boom' }),
    }),
  })

  await assert.rejects(() =>
    broker.callTool(
      { id: 'fs', name: 'Filesystem', url: 'http://localhost:3001', connected: true, tools: [] },
      'filesystem.read_file',
      { path: 'package.json' }
    )
  )
})

test('dispatches local tools without an MCP server', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-tool-broker-'))
  writeFileSync(join(root, 'package.json'), '{"name":"ai-box"}')
  const broker = new ToolBroker({ localRootDir: root })

  const result = await broker.callTool(null, 'local.read_file', {
    path: 'package.json',
  })

  assert.deepEqual(result, {
    path: 'package.json',
    content: '{"name":"ai-box"}',
  })
})

test('reuses pooled connections for the same server', async () => {
  let connectCount = 0
  const broker = new ToolBroker({
    clientFactory: () => ({
      connect: async () => {
        connectCount++
      },
      disconnect: async () => undefined,
      isConnected: () => connectCount > 0,
      getServer: () => ({
        id: 'fs',
        name: 'Filesystem',
        url: 'http://localhost:3001',
        connected: true,
        tools: [
          {
            name: 'filesystem.read_file',
            description: 'Read a file',
            inputSchema: {},
          },
        ],
      }),
      callTool: async () => ({ tool: 'filesystem.read_file', result: { text: 'ok' } }),
    }),
  })

  const server = { id: 'fs', name: 'Filesystem', url: 'http://localhost:3001', connected: true, tools: [] }

  await broker.listTools([server])
  assert.equal(connectCount, 1)

  await broker.callTool(server, 'filesystem.read_file', { path: 'test.txt' })
  assert.equal(connectCount, 1)

  assert.equal(broker.getPoolSize(), 1)
})

test('evicts idle connections after inactivity threshold', async () => {
  let disconnectCount = 0
  const broker = new ToolBroker({
    clientFactory: () => ({
      connect: async () => undefined,
      disconnect: async () => {
        disconnectCount++
      },
      isConnected: () => true,
      getServer: () => ({
        id: 'fs',
        name: 'Filesystem',
        url: 'http://localhost:3001',
        connected: true,
        tools: [],
      }),
      callTool: async () => ({ tool: 'filesystem.read_file', result: { text: 'ok' } }),
    }),
  })

  const server = { id: 'fs', name: 'Filesystem', url: 'http://localhost:3001', connected: true, tools: [] }

  // Monkey-patch Date.now to simulate time passing
  const originalNow = Date.now
  let currentTime = originalNow()

  Object.defineProperty(Date, 'now', {
    value: () => currentTime,
    writable: true,
    configurable: true,
  })

  try {
    await broker.listTools([server])
    assert.equal(broker.getPoolSize(), 1)

    // Fast-forward past the 5-minute idle threshold
    currentTime += 6 * 60 * 1000

    // Trigger eviction via another call
    await broker.listTools([server])
    assert.equal(disconnectCount, 1)
    assert.equal(broker.getPoolSize(), 1) // New client created after eviction
  } finally {
    Object.defineProperty(Date, 'now', {
      value: originalNow,
      writable: true,
      configurable: true,
    })
  }
})

test('disconnectAll clears the pool and disconnects all clients', async () => {
  let disconnectCount = 0
  const broker = new ToolBroker({
    clientFactory: () => ({
      connect: async () => undefined,
      disconnect: async () => {
        disconnectCount++
      },
      isConnected: () => true,
      getServer: () => ({
        id: 'fs',
        name: 'Filesystem',
        url: 'http://localhost:3001',
        connected: true,
        tools: [],
      }),
      callTool: async () => ({ tool: 'filesystem.read_file', result: { text: 'ok' } }),
    }),
  })

  const server = { id: 'fs', name: 'Filesystem', url: 'http://localhost:3001', connected: true, tools: [] }

  await broker.listTools([server])
  assert.equal(broker.getPoolSize(), 1)

  await broker.disconnectAll()
  assert.equal(broker.getPoolSize(), 0)
  assert.equal(disconnectCount, 1)
})
