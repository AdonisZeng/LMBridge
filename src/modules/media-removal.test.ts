import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const modulesDir = dirname(fileURLToPath(import.meta.url))

test('built-in modules expose assistant workspaces without media modules', () => {
  const builtins = readFileSync(join(modulesDir, 'builtins.ts'), 'utf8')

  assert.match(builtins, /chatModule/)
  assert.match(builtins, /ragModule/)
  assert.match(builtins, /agentModule/)
  assert.doesNotMatch(builtins, /imageModule|videoModule|audioModule/)
})
