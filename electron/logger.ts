import { join } from 'path'
import { existsSync, mkdirSync, appendFileSync, writeFileSync } from 'fs'

class Logger {
  private logFilePath: string
  private logDir: string

  constructor() {
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
    this.logDir = join(process.cwd(), 'logs')
    this.logFilePath = join(this.logDir, `${timestamp}.txt`)

    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true })
    }

    writeFileSync(this.logFilePath, `[${this.getTime()}] 日志启动\n`, { flag: 'w' })
  }

  private getTime(): string {
    const now = new Date()
    return now.toISOString()
  }

  private write(level: string, message: string, ...args: unknown[]): void {
    const time = this.getTime()
    const argStr = args.length > 0 ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') : ''
    const line = `[${time}] [${level}] ${message}${argStr}\n`
    appendFileSync(this.logFilePath, line, { flag: 'a' })
  }

  info(message: string, ...args: unknown[]): void {
    this.write('INFO', message, ...args)
  }

  warn(message: string, ...args: unknown[]): void {
    this.write('WARN', message, ...args)
  }

  error(message: string, ...args: unknown[]): void {
    this.write('ERROR', message, ...args)
  }

  debug(message: string, ...args: unknown[]): void {
    this.write('DEBUG', message, ...args)
  }
}

export const logger = new Logger()
