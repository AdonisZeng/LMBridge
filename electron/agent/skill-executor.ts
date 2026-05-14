import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentObservation } from '../../src/types/agent.ts'
import type { RunnerManager } from './runner-manager.ts'
import type { AgentSkillSummary } from './skill-registry.ts'

export interface SkillExecutionResult {
  status: 'success' | 'error'
  summary: string
  rawExcerpt: string
  observation: AgentObservation
}

export interface SkillExecutorDeps {
  runner: Pick<RunnerManager, 'run'>
}

export class SkillExecutor {
  private deps: SkillExecutorDeps

  constructor(deps: SkillExecutorDeps) {
    this.deps = deps
  }

  async execute(skill: AgentSkillSummary): Promise<SkillExecutionResult> {
    const skillBody = readFileSync(join(skill.rootDir, 'SKILL.md'), 'utf8')

    if (!skill.isExecutable || skill.entrypoints.length === 0) {
      return {
        status: 'success',
        summary: skill.description,
        rawExcerpt: skillBody.slice(0, 500),
        observation: {
          type: 'skill_result',
          actionId: `skill-${skill.id}`,
          name: skill.id,
          status: 'success',
          summary: skill.description,
          data: { mode: 'instruction-only' },
          rawExcerpt: skillBody.slice(0, 500),
          artifacts: [],
        },
      }
    }

    const entrypoint = skill.entrypoints[0]
    const result = await this.deps.runner.run({
      runner: entrypoint.runner,
      command: join(skill.rootDir, entrypoint.command),
      cwd: skill.rootDir,
    })
    const rawExcerpt = [result.stdout, result.stderr].filter(Boolean).join('\n').slice(0, 500)
    const status = result.exitCode === 0 ? 'success' : 'error'
    const summary = status === 'success' ? `${skill.name} completed` : `${skill.name} failed`

    return {
      status,
      summary,
      rawExcerpt,
      observation: {
        type: 'skill_result',
        actionId: `skill-${skill.id}`,
        name: skill.id,
        status,
        summary,
        data: {
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
        },
        rawExcerpt,
        artifacts: [],
      },
    }
  }
}
