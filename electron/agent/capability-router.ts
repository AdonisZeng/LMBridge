import type { MCPServer, MCPTool } from '../../src/types/mcp.ts'

export type CapabilitySource = 'built_in' | 'local' | 'mcp' | 'external'

export interface ListCapabilityToolsInput {
  builtInTools: MCPTool[]
  externalTools: MCPTool[]
  mcpServers: MCPServer[]
}

export interface ResolveCapabilityInput {
  toolName: string
  mcpServers: MCPServer[]
}

export interface CapabilityRoute {
  source: CapabilitySource
  server: MCPServer | null
  toolName: string
}

export class CapabilityRouter {
  listTools(input: ListCapabilityToolsInput): MCPTool[] {
    const tools = [
      ...input.builtInTools,
      ...input.externalTools,
      ...this.listPrefixedMcpTools(input.mcpServers),
    ]
    const seen = new Set<string>()

    return tools.filter((tool) => {
      if (seen.has(tool.name)) {
        return false
      }

      seen.add(tool.name)
      return true
    })
  }

  resolve(input: ResolveCapabilityInput): CapabilityRoute {
    const prefixed = this.parsePrefixedMcpToolName(input.toolName)
    if (prefixed) {
      const server = input.mcpServers.find((item) => item.id === prefixed.serverId)
      if (!server) {
        throw new Error(`No MCP server is available for tool ${input.toolName}`)
      }

      return {
        source: 'mcp',
        server,
        toolName: prefixed.toolName,
      }
    }

    if (input.toolName.startsWith('local.')) {
      return {
        source: 'local',
        server: null,
        toolName: input.toolName,
      }
    }

    const matchingServer = input.mcpServers.find((server) =>
      server.tools.some((tool) => tool.name === input.toolName)
    )
    if (matchingServer) {
      return {
        source: 'mcp',
        server: matchingServer,
        toolName: input.toolName,
      }
    }

    const fallbackServer = input.mcpServers[0]
    if (fallbackServer) {
      return {
        source: 'external',
        server: fallbackServer,
        toolName: input.toolName,
      }
    }

    return {
      source: 'external',
      server: null,
      toolName: input.toolName,
    }
  }

  private listPrefixedMcpTools(servers: MCPServer[]): MCPTool[] {
    return servers.flatMap((server) =>
      server.tools.map((tool) => ({
        ...tool,
        name: this.prefixMcpToolName(server.id, tool.name),
        description: `[${server.name}] ${tool.description}`,
      }))
    )
  }

  private prefixMcpToolName(serverId: string, toolName: string): string {
    return `mcp__${serverId}__${toolName}`
  }

  private parsePrefixedMcpToolName(
    value: string
  ): { serverId: string; toolName: string } | null {
    const match = value.match(/^mcp__(.+?)__(.+)$/)
    if (!match?.[1] || !match[2]) {
      return null
    }

    return {
      serverId: match[1],
      toolName: match[2],
    }
  }
}
