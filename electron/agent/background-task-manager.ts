import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { RunnerManager, RunnerRequest, RunnerResult } from './runner-manager.ts'

const DEFAULT_BACKGROUND_ROOT = join(homedir(), '.agents', 'background')
const BACKGROUND_INDEX_FILE = 'background-tasks.json'

export type BackgroundTaskStatus = 'running' | 'completed' | 'failed'

export interface BackgroundTaskRecord {
  id: string
  runner: RunnerRequest['runner']
  command: string
  cwd: string
  summary: string
  status: BackgroundTaskStatus
  stdout: string
  stderr: string
  exitCode?: number
  logPath: string
  createdAt: number
  updatedAt: number
}

export interface BackgroundTaskStartInput extends RunnerRequest {
  summary: string
}

export interface BackgroundTaskManagerOptions {
  rootDir?: string
  runner: Pick<RunnerManager, 'run'>
}

export class BackgroundTaskManager {
  private rootDir: string
  private runner: Pick<RunnerManager, 'run'>

  constructor(options: BackgroundTaskManagerOptions) {
    this.rootDir = options.rootDir ?? DEFAULT_BACKGROUND_ROOT
    this.runner = options.runner
  }

  async start(input: BackgroundTaskStartInput): Promise<BackgroundTaskRecord> {
    mkdirSync(this.rootDir, { recursive: true })
    const timestamp = Date.now()
    const record: BackgroundTaskRecord = {
      id: `bg-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
      runner: input.runner,
      command: this.requireText(input.command, 'command'),
      cwd: this.requireText(input.cwd, 'cwd'),
      summary: this.requireText(input.summary, 'summary'),
      status: 'running',
      stdout: '',
      stderr: '',
      logPath: join(this.rootDir, `${timestamp}.log`),
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    this.upsert(record)
    void this.runner.run(input).then(
      (result) => this.complete(record.id, result),
      (error) =>
        this.complete(record.id, {
          exitCode: 1,
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error),
        })
    )

    return record
  }

  async check(id: string): Promise<BackgroundTaskRecord | null> {
    return this.read().find((task) => task.id === id) ?? null
  }

  private complete(id: string, result: RunnerResult): void {
    const records = this.read()
    const record = records.find((item) => item.id === id)
    if (!record) {
      return
    }

    record.exitCode = result.exitCode
    record.stdout = result.stdout
    record.stderr = result.stderr
    record.status = result.exitCode === 0 ? 'completed' : 'failed'
    record.updatedAt = Date.now()
    writeFileSync(
      record.logPath,
      [`exitCode=${result.exitCode}`, result.stdout, result.stderr].filter(Boolean).join('\n'),
      'utf8'
    )
    this.write(records)
  }

  private upsert(record: BackgroundTaskRecord): void {
    const records = this.read().filter((item) => item.id !== record.id)
    records.push(record)
    this.write(records)
  }

  private read(): BackgroundTaskRecord[] {
    const filePath = this.indexPath()
    if (!existsSync(filePath)) {
      return []
    }

    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as BackgroundTaskRecord[]
    return Array.isArray(parsed) ? parsed : []
  }

  private write(records: BackgroundTaskRecord[]): void {
    mkdirSync(this.rootDir, { recursive: true })
    writeFileSync(this.indexPath(), `${JSON.stringify(records, null, 2)}\n`, 'utf8')
  }

  private indexPath(): string {
    return join(this.rootDir, BACKGROUND_INDEX_FILE)
  }

  private requireText(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Background task ${field} must be a non-empty string`)
    }

    return value.trim()
  }
}
