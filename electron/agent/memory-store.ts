import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'

const DEFAULT_MEMORY_ROOT = join(homedir(), '.agents', 'memory')
const MEMORY_INDEX_FILE = 'MEMORY.md'

export type AgentMemoryType = 'user' | 'feedback' | 'project' | 'reference'

export interface AgentMemorySummary {
  id: string
  name: string
  type: AgentMemoryType
  description: string
  content: string
}

export interface SaveAgentMemoryInput {
  name: string
  type: AgentMemoryType
  description: string
  content: string
}

interface MemoryFrontmatter {
  name: string
  type: AgentMemoryType
  description: string
}

export class MemoryStore {
  private rootDir: string

  constructor(rootDir = DEFAULT_MEMORY_ROOT) {
    this.rootDir = rootDir
  }

  async list(): Promise<AgentMemorySummary[]> {
    if (!existsSync(this.rootDir)) {
      return []
    }

    return readdirSync(this.rootDir)
      .filter((entry) => entry.endsWith('.md') && entry !== MEMORY_INDEX_FILE)
      .flatMap((entry) => this.loadMemory(entry))
  }

  async save(input: SaveAgentMemoryInput): Promise<AgentMemorySummary> {
    const memory = this.normalizeInput(input)
    this.ensureSafeContent(memory.content)
    mkdirSync(this.rootDir, { recursive: true })
    const id = this.slugify(memory.name)
    const filePath = join(this.rootDir, `${id}.md`)
    const frontmatter = stringify({
      name: memory.name,
      type: memory.type,
      description: memory.description,
    }).trim()

    writeFileSync(filePath, `---\n${frontmatter}\n---\n\n${memory.content}\n`, 'utf8')
    const saved = { id, ...memory }
    await this.writeIndex()

    return saved
  }

  private loadMemory(entry: string): AgentMemorySummary[] {
    const id = entry.replace(/\.md$/i, '')
    const content = readFileSync(join(this.rootDir, entry), 'utf8')
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
    if (!match) {
      return []
    }

    const metadata = parse(match[1]) as MemoryFrontmatter
    if (!metadata?.name || !metadata.description || !this.isMemoryType(metadata.type)) {
      return []
    }

    return [
      {
        id,
        name: metadata.name,
        type: metadata.type,
        description: metadata.description,
        content: match[2].trim(),
      },
    ]
  }

  private async writeIndex(): Promise<void> {
    const entries = await this.list()
    const lines = [
      '# AI Box Memory',
      '',
      ...entries.map(
        (entry) => `- ${entry.id}: [${entry.type}] ${entry.name} - ${entry.description}`
      ),
      '',
    ]

    writeFileSync(join(this.rootDir, MEMORY_INDEX_FILE), lines.join('\n'), 'utf8')
  }

  private normalizeInput(input: SaveAgentMemoryInput): SaveAgentMemoryInput {
    const name = this.requireNonEmpty(input.name, 'name')
    const description = this.requireNonEmpty(input.description, 'description')
    const content = this.requireNonEmpty(input.content, 'content')
    if (!this.isMemoryType(input.type)) {
      throw new Error(`Unsupported memory type: ${String(input.type)}`)
    }

    return {
      name,
      type: input.type,
      description,
      content,
    }
  }

  private ensureSafeContent(content: string): void {
    if (/(api[_-]?key|secret|token|password)\s*[:=]\s*\S+/i.test(content) || /sk-[a-z0-9_-]+/i.test(content)) {
      throw new Error('Memory content appears to contain a secret and will not be saved')
    }
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  private requireNonEmpty(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Memory ${field} must be a non-empty string`)
    }

    return value.trim()
  }

  private isMemoryType(value: unknown): value is AgentMemoryType {
    return value === 'user' || value === 'feedback' || value === 'project' || value === 'reference'
  }
}
