import type { MCPServer, MCPTool } from '../../src/types/mcp.ts'
import { MCPClient } from '../../src/lib/mcp/client.ts'
import { LocalToolDispatcher } from './local-tool-dispatcher.ts'

type ClientLike = Pick<MCPClient, 'connect' | 'getServer' | 'callTool' | 'disconnect' | 'isConnected'>

export interface ToolBrokerOptions {
  clientFactory?: (server: MCPServer) => ClientLike
  localRootDir?: string
  localTools?: LocalToolDispatcher | null
}

interface PooledClient {
  client: ClientLike
  lastUsed: number
}

const IDLE_DISCONNECT_MS = 5 * 60 * 1000 // 5 minutes

export class ToolBroker {
  private clientFactory: (server: MCPServer) => ClientLike
  private localTools: LocalToolDispatcher | null
  private pool = new Map<string, PooledClient>()

  constructor(options: ToolBrokerOptions = {}) {
    this.clientFactory = options.clientFactory ?? ((server) => new MCPClient(server))
    this.localTools =
      options.localTools === undefined
        ? new LocalToolDispatcher({ rootDir: options.localRootDir ?? process.cwd() })
        : options.localTools
  }

  private getOrCreateClient(server: MCPServer): ClientLike {
    const existing = this.pool.get(server.url)
    if (existing) {
      existing.lastUsed = Date.now()
      return existing.client
    }

    const client = this.clientFactory(server)
    this.pool.set(server.url, {
      client,
      lastUsed: Date.now(),
    })
    return client
  }

  private async ensureConnected(client: ClientLike): Promise<void> {
    if (!client.isConnected()) {
      await client.connect()
    }
  }

  private maybeEvictIdleClients(): void {
    const now = Date.now()
    for (const [url, entry] of this.pool) {
      if (now - entry.lastUsed > IDLE_DISCONNECT_MS) {
        entry.client.disconnect().catch(() => {
          // Ignore disconnect errors
        })
        this.pool.delete(url)
      }
    }
  }

  async listTools(servers: MCPServer[]): Promise<MCPTool[]> {
    this.maybeEvictIdleClients()

    const tools: MCPTool[] = []
    if (this.localTools) {
      tools.push(...this.localTools.listTools())
    }

    for (const server of servers) {
      const client = this.getOrCreateClient(server)
      await this.ensureConnected(client)
      tools.push(...client.getServer().tools)
    }

    return tools
  }

  async callTool(
    server: MCPServer | null,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    this.maybeEvictIdleClients()

    if (this.localTools?.canHandle(toolName)) {
      return this.localTools.callTool(toolName, args)
    }

    if (!server) {
      throw new Error(`No MCP server is available for tool ${toolName}`)
    }

    const client = this.getOrCreateClient(server)
    await this.ensureConnected(client)
    const result = await client.callTool({ name: toolName, arguments: args })

    if (result.error) {
      throw new Error(result.error)
    }

    return result.result
  }

  async disconnectAll(): Promise<void> {
    await Promise.allSettled(
      [...this.pool.values()].map((entry) =>
        entry.client.disconnect().catch(() => {
          // Ignore disconnect errors during cleanup
        })
      )
    )
    this.pool.clear()
  }

  getPoolSize(): number {
    return this.pool.size
  }
}
