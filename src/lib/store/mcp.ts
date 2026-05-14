import { create } from 'zustand'
import type { MCPServer, MCPTool } from '@/types/mcp'
import { MCPClient } from '@/lib/mcp'

interface MCPState {
  servers: Map<string, MCPClient>
  serverConfigs: MCPServer[]
  isConnecting: boolean

  addServer: (config: Omit<MCPServer, 'connected' | 'tools'>) => Promise<void>
  removeServer: (id: string) => void
  connectServer: (id: string) => Promise<void>
  disconnectServer: (id: string) => void
  getAllTools: () => MCPTool[]
  callTool: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<unknown>
}

export const useMCPStore = create<MCPState>((set, get) => ({
  servers: new Map(),
  serverConfigs: [],
  isConnecting: false,

  addServer: async (config) => {
    const client = new MCPClient(config)
    const newConfig: MCPServer = {
      ...config,
      connected: false,
      tools: [],
    }
    set((state) => {
      const newServers = new Map(state.servers)
      newServers.set(config.id, client)
      return {
        servers: newServers,
        serverConfigs: [...state.serverConfigs, newConfig],
      }
    })
  },

  removeServer: (id) => {
    const { servers } = get()
    const client = servers.get(id)
    if (client) {
      client.disconnect()
    }
    set((state) => {
      const newServers = new Map(state.servers)
      newServers.delete(id)
      return {
        servers: newServers,
        serverConfigs: state.serverConfigs.filter((s) => s.id !== id),
      }
    })
  },

  connectServer: async (id) => {
    const { servers } = get()
    const client = servers.get(id)
    if (!client) return

    set({ isConnecting: true })
    try {
      await client.connect()
      const server = client.getServer()
      set((state) => ({
        serverConfigs: state.serverConfigs.map((s) =>
          s.id === id ? { ...s, connected: true, tools: server.tools } : s
        ),
        isConnecting: false,
      }))
    } catch {
      set((state) => ({
        serverConfigs: state.serverConfigs.map((s) =>
          s.id === id ? { ...s, connected: false, tools: [] } : s
        ),
        isConnecting: false,
      }))
    }
  },

  disconnectServer: (id) => {
    const { servers } = get()
    const client = servers.get(id)
    if (client) {
      client.disconnect()
    }
    set((state) => ({
      serverConfigs: state.serverConfigs.map((s) =>
        s.id === id ? { ...s, connected: false, tools: [] } : s
      ),
    }))
  },

  getAllTools: () => {
    const { servers } = get()
    const allTools: MCPTool[] = []
    servers.forEach((client) => {
      allTools.push(...client.getTools())
    })
    return allTools
  },

  callTool: async (serverId, toolName, args) => {
    const { servers } = get()
    const client = servers.get(serverId)
    if (!client) {
      throw new Error(`Server ${serverId} not found`)
    }
    const result = await client.callTool({ name: toolName, arguments: args })
    if (result.error) {
      throw new Error(result.error)
    }
    return result.result
  },
}))
