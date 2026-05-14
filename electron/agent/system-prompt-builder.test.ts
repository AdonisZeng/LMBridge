import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { SystemPromptBuilder } from './system-prompt-builder.ts'

test('builds a layered agent system prompt with tools, skills, memory, and dynamic context', () => {
  const prompt = new SystemPromptBuilder().build({
    mode: 'confirm-external',
    tools: [{ name: 'local.read_file', description: 'Read a local file', inputSchema: {} }],
    skills: [
      {
        id: 'repo-summary',
        name: 'repo-summary',
        description: 'Summarize repositories',
        rootDir: 'C:/skills/repo-summary',
        tags: ['code'],
        isExecutable: false,
        allowedMcpTools: [],
        entrypoints: [],
      },
    ],
    memories: [
      {
        id: 'prefer-concise',
        name: 'Prefer concise',
        type: 'user',
        description: 'User prefers concise answers.',
        content: 'Keep final answers concise.',
      },
    ],
    dynamicContext: {
      cwd: 'D:/Development/Electron/AI-Box',
      currentDate: '2026-04-23',
    },
  })

  assert.match(prompt, /You are the AI Box agent planner/)
  assert.match(prompt, /## Available Tools/)
  assert.match(prompt, /local\.read_file/)
  assert.match(prompt, /## Available Skills/)
  assert.match(prompt, /repo-summary/)
  assert.match(prompt, /## Memory/)
  assert.match(prompt, /Prefer concise/)
  assert.match(prompt, /## Dynamic Context/)
  assert.match(prompt, /confirm-external/)
  assert.equal(prompt.indexOf('## Available Tools') < prompt.indexOf('## Available Skills'), true)
  assert.equal(prompt.indexOf('## Memory') < prompt.indexOf('## Dynamic Context'), true)
})
