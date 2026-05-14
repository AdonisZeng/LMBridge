export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface MCPServer {
  id: string
  name: string
  url: string
  connected: boolean
  tools: MCPTool[]
}

export interface MCPToolCall {
  name: string
  arguments: Record<string, unknown>
}

export interface MCPToolResult {
  tool: string
  result: unknown
  error?: string
}
