import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DEFAULT_TASK_GRAPH_ROOT = join(homedir(), '.agents', 'tasks')
const TASK_GRAPH_FILE = 'task-graph.json'

export type AgentGraphTaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'

export interface AgentGraphTask {
  id: string
  title: string
  description: string
  status: AgentGraphTaskStatus
  blockedBy: string[]
  blocks: string[]
  ready: boolean
  createdAt: number
  updatedAt: number
}

export interface CreateGraphTaskInput {
  title: string
  description: string
  blockedBy?: string[]
}

export interface UpdateGraphTaskInput {
  title?: string
  description?: string
  status?: AgentGraphTaskStatus
  blockedBy?: string[]
}

export interface ListGraphTasksOptions {
  readyOnly?: boolean
}

interface StoredGraphTask {
  id: string
  title: string
  description: string
  status: AgentGraphTaskStatus
  blockedBy: string[]
  blocks: string[]
  createdAt: number
  updatedAt: number
}

export class TaskGraphStore {
  private rootDir: string

  constructor(rootDir = DEFAULT_TASK_GRAPH_ROOT) {
    this.rootDir = rootDir
  }

  async create(input: CreateGraphTaskInput): Promise<AgentGraphTask> {
    const tasks = this.read()
    const timestamp = Date.now()
    const task: StoredGraphTask = {
      id: this.createId(input.title, tasks),
      title: this.requireText(input.title, 'title'),
      description: this.requireText(input.description, 'description'),
      status: 'todo',
      blockedBy: this.normalizeIds(input.blockedBy),
      blocks: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    tasks.push(task)
    this.rebuildBlocks(tasks)
    this.write(tasks)

    return this.present(task, tasks)
  }

  async update(id: string, input: UpdateGraphTaskInput): Promise<AgentGraphTask> {
    const tasks = this.read()
    const task = tasks.find((item) => item.id === id)
    if (!task) {
      throw new Error(`Unknown graph task: ${id}`)
    }

    if (input.title !== undefined) {
      task.title = this.requireText(input.title, 'title')
    }
    if (input.description !== undefined) {
      task.description = this.requireText(input.description, 'description')
    }
    if (input.status !== undefined) {
      task.status = this.requireStatus(input.status)
    }
    if (input.blockedBy !== undefined) {
      task.blockedBy = this.normalizeIds(input.blockedBy)
    }
    task.updatedAt = Date.now()

    this.rebuildBlocks(tasks)
    this.write(tasks)

    return this.present(task, tasks)
  }

  async get(id: string): Promise<AgentGraphTask | null> {
    const tasks = this.read()
    const task = tasks.find((item) => item.id === id)

    return task ? this.present(task, tasks) : null
  }

  async list(options: ListGraphTasksOptions = {}): Promise<AgentGraphTask[]> {
    const tasks = this.read()
    const presented = tasks.map((task) => this.present(task, tasks))

    return options.readyOnly ? presented.filter((task) => task.ready) : presented
  }

  private read(): StoredGraphTask[] {
    const filePath = this.filePath()
    if (!existsSync(filePath)) {
      return []
    }

    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as StoredGraphTask[]
    return Array.isArray(parsed) ? parsed : []
  }

  private write(tasks: StoredGraphTask[]): void {
    mkdirSync(this.rootDir, { recursive: true })
    writeFileSync(this.filePath(), `${JSON.stringify(tasks, null, 2)}\n`, 'utf8')
  }

  private filePath(): string {
    return join(this.rootDir, TASK_GRAPH_FILE)
  }

  private present(task: StoredGraphTask, allTasks: StoredGraphTask[]): AgentGraphTask {
    return {
      ...task,
      ready: this.isReady(task, allTasks),
    }
  }

  private isReady(task: StoredGraphTask, allTasks: StoredGraphTask[]): boolean {
    if (task.status === 'done' || task.status === 'cancelled') {
      return false
    }

    return task.blockedBy.every((blockerId) => {
      const blocker = allTasks.find((item) => item.id === blockerId)
      return blocker?.status === 'done'
    })
  }

  private rebuildBlocks(tasks: StoredGraphTask[]): void {
    for (const task of tasks) {
      task.blocks = []
    }

    for (const task of tasks) {
      for (const blockerId of task.blockedBy) {
        const blocker = tasks.find((item) => item.id === blockerId)
        if (blocker && !blocker.blocks.includes(task.id)) {
          blocker.blocks.push(task.id)
        }
      }
    }
  }

  private createId(title: string, tasks: StoredGraphTask[]): string {
    const base = this.slugify(this.requireText(title, 'title')) || 'task'
    let id = base
    let index = 2
    const used = new Set(tasks.map((task) => task.id))

    while (used.has(id)) {
      id = `${base}-${index}`
      index += 1
    }

    return id
  }

  private normalizeIds(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
  }

  private requireText(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Graph task ${field} must be a non-empty string`)
    }

    return value.trim()
  }

  private requireStatus(value: unknown): AgentGraphTaskStatus {
    if (value === 'todo' || value === 'in_progress' || value === 'done' || value === 'cancelled') {
      return value
    }

    throw new Error(`Unsupported graph task status: ${String(value)}`)
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
}
