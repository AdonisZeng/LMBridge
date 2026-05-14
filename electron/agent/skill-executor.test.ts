import * as assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { SkillExecutor } from './skill-executor.ts'

test('returns instruction-only skills without launching a runner', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-skill-exec-'))
  writeFileSync(
    join(root, 'SKILL.md'),
    `---\nname: repo-guide\ndescription: Explain repository structure\n---\n\n# Repo Guide\n\nUse this skill to explain repository structure.\n`
  )

  let runnerCalled = false
  const executor = new SkillExecutor({
    runner: {
      run: async () => {
        runnerCalled = true
        return { exitCode: 0, stdout: '', stderr: '' }
      },
    },
  })

  const result = await executor.execute({
    id: 'repo-guide',
    name: 'repo-guide',
    description: 'Explain repository structure',
    rootDir: root,
    tags: ['docs'],
    isExecutable: false,
    allowedMcpTools: [],
    entrypoints: [],
  })

  assert.equal(runnerCalled, false)
  assert.match(result.summary, /repository structure/i)
})

test('runs the first declared entrypoint for executable skills', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-skill-exec-'))
  writeFileSync(
    join(root, 'SKILL.md'),
    `---\nname: repo-summary\ndescription: Summarize repositories\n---\n\n# Repo Summary\n`
  )

  const executor = new SkillExecutor({
    runner: {
      run: async (request) => {
        assert.equal(request.runner, 'python')
        assert.match(request.command, /scripts[\\/]run.py/)
        return {
          exitCode: 0,
          stdout: 'summary-ready',
          stderr: '',
        }
      },
    },
  })

  const result = await executor.execute({
    id: 'repo-summary',
    name: 'repo-summary',
    description: 'Summarize repositories',
    rootDir: root,
    tags: ['code'],
    isExecutable: true,
    allowedMcpTools: ['filesystem.read_file'],
    entrypoints: [{ runner: 'python', command: 'scripts/run.py' }],
  })

  assert.equal(result.status, 'success')
  assert.match(result.rawExcerpt, /summary-ready/)
})
