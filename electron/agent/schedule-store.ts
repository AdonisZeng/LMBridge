import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DEFAULT_SCHEDULE_ROOT = join(homedir(), '.agents', 'schedules')
const SCHEDULE_FILE = 'schedules.json'

export type AgentScheduleStatus = 'active' | 'paused'

export interface AgentSchedule {
  id: string
  name: string
  prompt: string
  everyMinutes: number
  status: AgentScheduleStatus
  nextRunAt: number
  lastRunAt?: number
  createdAt: number
  updatedAt: number
}

export interface CreateScheduleInput {
  name: string
  prompt: string
  everyMinutes: number
  startAt?: number
}

export interface ScheduleNotification {
  scheduleId: string
  name: string
  prompt: string
  dueAt: number
}

export class ScheduleStore {
  private rootDir: string

  constructor(rootDir = DEFAULT_SCHEDULE_ROOT) {
    this.rootDir = rootDir
  }

  async create(input: CreateScheduleInput): Promise<AgentSchedule> {
    const schedules = this.read()
    const timestamp = Date.now()
    const everyMinutes = this.requirePositiveNumber(input.everyMinutes, 'everyMinutes')
    const schedule: AgentSchedule = {
      id: this.createId(input.name, schedules),
      name: this.requireText(input.name, 'name'),
      prompt: this.requireText(input.prompt, 'prompt'),
      everyMinutes,
      status: 'active',
      nextRunAt: input.startAt ?? timestamp + everyMinutes * 60_000,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    schedules.push(schedule)
    this.write(schedules)

    return schedule
  }

  async get(id: string): Promise<AgentSchedule | null> {
    return this.read().find((schedule) => schedule.id === id) ?? null
  }

  async list(): Promise<AgentSchedule[]> {
    return this.read()
  }

  async checkDue(now = Date.now()): Promise<ScheduleNotification[]> {
    const schedules = this.read()
    const due: ScheduleNotification[] = []

    for (const schedule of schedules) {
      if (schedule.status !== 'active' || schedule.nextRunAt > now) {
        continue
      }

      due.push({
        scheduleId: schedule.id,
        name: schedule.name,
        prompt: schedule.prompt,
        dueAt: schedule.nextRunAt,
      })
      schedule.lastRunAt = now
      schedule.nextRunAt = now + schedule.everyMinutes * 60_000
      schedule.updatedAt = now
    }

    if (due.length > 0) {
      this.write(schedules)
    }

    return due
  }

  private read(): AgentSchedule[] {
    const filePath = this.filePath()
    if (!existsSync(filePath)) {
      return []
    }

    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as AgentSchedule[]
    return Array.isArray(parsed) ? parsed : []
  }

  private write(schedules: AgentSchedule[]): void {
    mkdirSync(this.rootDir, { recursive: true })
    writeFileSync(this.filePath(), `${JSON.stringify(schedules, null, 2)}\n`, 'utf8')
  }

  private filePath(): string {
    return join(this.rootDir, SCHEDULE_FILE)
  }

  private createId(name: string, schedules: AgentSchedule[]): string {
    const base = this.slugify(this.requireText(name, 'name')) || 'schedule'
    let id = base
    let index = 2
    const used = new Set(schedules.map((schedule) => schedule.id))
    while (used.has(id)) {
      id = `${base}-${index}`
      index += 1
    }

    return id
  }

  private requireText(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Schedule ${field} must be a non-empty string`)
    }

    return value.trim()
  }

  private requirePositiveNumber(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error(`Schedule ${field} must be a positive number`)
    }

    return value
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
}
