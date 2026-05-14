import * as assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { SkillRegistry } from './skill-registry.ts'

test('loads summaries from SKILL.md and optional agents/ai-box.yaml', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-skills-'))
  const skillDir = join(root, 'repo-summary')
  mkdirSync(join(skillDir, 'agents'), { recursive: true })
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---\nname: repo-summary\ndescription: Summarize repositories and codebases\n---\n\n# Repo Summary\n`
  )
  writeFileSync(
    join(skillDir, 'agents', 'ai-box.yaml'),
    `display_name: Repo Summary\ntags:\n  - code\nallowed_mcp_tools:\n  - filesystem.read_file\nentrypoints:\n  - runner: python\n    command: scripts/run.py\n`
  )

  const registry = new SkillRegistry(root)
  const skills = await registry.load()

  assert.equal(skills.length, 1)
  assert.equal(skills[0]?.id, 'repo-summary')
  assert.equal(skills[0]?.isExecutable, true)
  assert.deepEqual(skills[0]?.allowedMcpTools, ['filesystem.read_file'])

  const loaded = await registry.loadContent('repo-summary')
  assert.equal(loaded?.id, 'repo-summary')
  assert.match(loaded?.content ?? '', /# Repo Summary/)
})

test('ignores directories without SKILL.md', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-box-skills-'))
  mkdirSync(join(root, 'broken-skill'), { recursive: true })

  const registry = new SkillRegistry(root)
  const skills = await registry.load()

  assert.deepEqual(skills, [])
})
