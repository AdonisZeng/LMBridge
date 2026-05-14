import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import type { MCPTool } from '../../src/types/mcp.ts'

type LocalToolHandler = (args: Record<string, unknown>) => Promise<Record<string, unknown>>

export interface LocalToolDispatcherOptions {
  rootDir: string
}

export class LocalToolDispatcher {
  private readonly rootDir: string
  private readonly handlers: Map<string, LocalToolHandler>

  constructor(options: LocalToolDispatcherOptions) {
    this.rootDir = resolve(options.rootDir)
    this.handlers = new Map([
      ['local.read_file', (args) => this.readFile(args)],
      ['local.write_file', (args) => this.writeFile(args)],
      ['local.edit_file', (args) => this.editFile(args)],
    ])
  }

  listTools(): MCPTool[] {
    return [
      {
        name: 'local.read_file',
        description: 'Read a UTF-8 text file inside the configured local workspace root.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative file path inside the local root.' },
          },
          required: ['path'],
        },
      },
      {
        name: 'local.write_file',
        description: 'Write a UTF-8 text file inside the configured local workspace root.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative file path inside the local root.' },
            content: { type: 'string', description: 'Full file content to write.' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'local.edit_file',
        description:
          'Replace exact text in a UTF-8 file inside the configured local workspace root.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative file path inside the local root.' },
            oldText: { type: 'string', description: 'Exact text to replace.' },
            newText: { type: 'string', description: 'Replacement text.' },
          },
          required: ['path', 'oldText', 'newText'],
        },
      },
    ]
  }

  canHandle(toolName: string): boolean {
    return this.handlers.has(toolName)
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const handler = this.handlers.get(toolName)
    if (!handler) {
      throw new Error(`Unknown local tool: ${toolName}`)
    }

    return handler(args)
  }

  private async readFile(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const target = this.resolveLocalPath(this.requireString(args, 'path'))
    const content = await readFile(target.absolutePath, 'utf8')

    return {
      path: target.relativePath,
      content,
    }
  }

  private async writeFile(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const target = this.resolveLocalPath(this.requireString(args, 'path'))
    const content = this.requireString(args, 'content')

    await mkdir(dirname(target.absolutePath), { recursive: true })
    await writeFile(target.absolutePath, content, 'utf8')

    return {
      path: target.relativePath,
      bytes: Buffer.byteLength(content, 'utf8'),
    }
  }

  private async editFile(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const target = this.resolveLocalPath(this.requireString(args, 'path'))
    const oldText = this.requireString(args, 'oldText')
    const newText = this.requireString(args, 'newText')
    const content = await readFile(target.absolutePath, 'utf8')
    const replacements = content.split(oldText).length - 1

    if (replacements === 0) {
      throw new Error(`Text to replace was not found in ${target.relativePath}`)
    }

    await writeFile(target.absolutePath, content.split(oldText).join(newText), 'utf8')

    return {
      path: target.relativePath,
      replacements,
    }
  }

  private resolveLocalPath(path: string): { absolutePath: string; relativePath: string } {
    const absolutePath = resolve(this.rootDir, path)
    const relativePath = relative(this.rootDir, absolutePath)

    if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new Error(`Path ${path} is outside the local tool root`)
    }

    return {
      absolutePath,
      relativePath: relativePath.split(sep).join('/'),
    }
  }

  private requireString(args: Record<string, unknown>, field: string): string {
    const value = args[field]
    if (typeof value !== 'string') {
      throw new Error(`Local tool argument ${field} must be a string`)
    }

    return value
  }
}
