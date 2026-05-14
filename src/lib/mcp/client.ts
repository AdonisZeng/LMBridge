import type { MCPServer, MCPTool, MCPToolCall, MCPToolResult } from '@/types/mcp'

export class MCPClient {
  private server: MCPServer
  private abortController: AbortController | null = null

  constructor(server: Omit<MCPServer, 'connected' | 'tools'>) {
    this.server = { ...server, connected: false, tools: [] }
  }

  async connect(): Promise<void> {
    this.abortController = new AbortController()

    try {
      // Initialize MCP connection via SSE
      const response = await fetch(`${this.server.url}/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            clientInfo: { name: 'ai-box', version: '1.0.0' },
          },
        }),
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`Failed to connect to MCP server: ${response.status}`)
      }

      this.server.connected = true

      // List available tools
      await this.listTools()
    } catch (error) {
      this.server.connected = false
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.server.connected = false
    this.server.tools = []
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.server.connected) {
      throw new Error('Not connected to MCP server')
    }

    try {
      const response = await fetch(`${this.server.url}/tools/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        }),
        signal: this.abortController?.signal,
      })

      if (!response.ok) {
        throw new Error(`Failed to list tools: ${response.status}`)
      }

      const data = await response.json()
      this.server.tools = data.result?.tools || []
      return this.server.tools
    } catch {
      return []
    }
  }

  async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    if (!this.server.connected) {
      return { tool: toolCall.name, result: null, error: 'Not connected' }
    }

    try {
      const response = await fetch(`${this.server.url}/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: toolCall.name,
            arguments: toolCall.arguments,
          },
        }),
        signal: this.abortController?.signal,
      })

      if (!response.ok) {
        throw new Error(`Tool call failed: ${response.status}`)
      }

      const data = await response.json()
      return {
        tool: toolCall.name,
        result: data.result,
      }
    } catch (error) {
      return {
        tool: toolCall.name,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  getServer(): MCPServer {
    return { ...this.server }
  }

  isConnected(): boolean {
    return this.server.connected
  }

  getTools(): MCPTool[] {
    return [...this.server.tools]
  }
}
