import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

export interface RunnerRequest {
  runner: 'node' | 'python' | 'shell'
  command: string
  cwd: string
}

export interface RunnerResult {
  exitCode: number
  stdout: string
  stderr: string
}

const DANGEROUS_PATTERNS = [
  new RegExp('rm\\s+-rf\\s+/', 'i'),
  new RegExp('rm\\s+-rf\\s+~/', 'i'),
  new RegExp('rm\\s+-rf\\s+"?/', 'i'),
  new RegExp('rmdir\\s+/s\\s+\\\\?', 'i'),
  new RegExp('format\\s+', 'i'),
  new RegExp('del\\s+/q\\s+/s\\s+', 'i'),
  new RegExp('mkfs\\.', 'i'),
  new RegExp('dd\\s+if=.+of=/dev/', 'i'),
  new RegExp('>\\s*/dev/', 'i'),
]

export class RunnerSecurityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RunnerSecurityError'
  }
}

export class RunnerManager {
  private allowedRoots: string[]
  private isWindows: boolean

  constructor(allowedRoots?: string[]) {
    this.isWindows = process.platform === 'win32'
    this.allowedRoots = (allowedRoots ?? [resolve(process.cwd()), resolve(homedir())]).map((r) =>
      this.isWindows ? r.toLowerCase() : r
    )
  }

  resolveCommand(
    runner: RunnerRequest['runner'],
    command: string
  ): {
    command: string
    args: string[]
  } {
    if (runner === 'node') {
      return { command: 'node', args: [command] }
    }

    if (runner === 'python') {
      return { command: 'python', args: [command] }
    }

    if (process.platform === 'win32') {
      if (command.endsWith('.ps1')) {
        return { command: 'powershell', args: ['-File', command] }
      }
      if (command.endsWith('.bat') || command.endsWith('.cmd')) {
        return { command: 'cmd', args: ['/c', command] }
      }
      return { command: 'cmd', args: ['/c', command] }
    }

    return { command: 'sh', args: [command] }
  }

  private isCommandDangerous(command: string): boolean {
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command))
  }

  private isAllowedCwd(cwd: string): boolean {
    const normalizedCwd = this.isWindows ? resolve(cwd).toLowerCase() : resolve(cwd)
    return this.allowedRoots.some((root) =>
      normalizedCwd === root || normalizedCwd.startsWith(root + (this.isWindows ? '\\' : '/'))
    )
  }

  run(request: RunnerRequest): Promise<RunnerResult> {
    if (this.isCommandDangerous(request.command)) {
      return Promise.reject(
        new RunnerSecurityError(`Command blocked by security policy: ${request.command}`)
      )
    }

    if (!this.isAllowedCwd(request.cwd)) {
      return Promise.reject(
        new RunnerSecurityError(
          `Working directory not allowed: ${request.cwd}. Must be within one of: ${this.allowedRoots.join(', ')}`
        )
      )
    }

    const resolved = this.resolveCommand(request.runner, request.command)

    return new Promise((resolve, reject) => {
      const child = spawn(resolved.command, resolved.args, {
        cwd: request.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString()
      })
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })
      child.on('error', reject)
      child.on('close', (exitCode) => {
        resolve({
          exitCode: exitCode ?? 1,
          stdout,
          stderr,
        })
      })
    })
  }
}
