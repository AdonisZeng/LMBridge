import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const providersDir = dirname(fileURLToPath(import.meta.url))

test('provider settings only expose text generation categories', () => {
  const registry = readFileSync(join(providersDir, 'registry.ts'), 'utf8')

  assert.match(registry, /text:\s*\[/)
  assert.match(registry, /text:\s*'文本生成'/)
  assert.doesNotMatch(registry, /\b(image|video|voice|music):\s*\[/)
  assert.doesNotMatch(registry, /\b(image|video|voice|music):\s*'/)
})
