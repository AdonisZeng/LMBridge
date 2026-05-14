import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const rendererDir = dirname(fileURLToPath(import.meta.url))
const indexCss = readFileSync(join(rendererDir, 'index.css'), 'utf8')

test('global scrollbars use the AI Box theme instead of native light scrollbars', () => {
  assert.match(indexCss, /--scrollbar-track:/)
  assert.match(indexCss, /--scrollbar-thumb:/)
  assert.match(indexCss, /--scrollbar-thumb-hover:/)
  assert.match(indexCss, /--scrollbar-corner:/)
  assert.match(indexCss, /\.dark\s*\{[\s\S]*--scrollbar-track:/)
  assert.match(indexCss, /scrollbar-color:\s*var\(--scrollbar-thumb\)\s+var\(--scrollbar-track\)/)
  assert.match(indexCss, /\*\s*::-webkit-scrollbar\s*\{[\s\S]*width:\s*var\(--scrollbar-size\)/)
  assert.match(indexCss, /\*\s*::-webkit-scrollbar\s*\{[\s\S]*height:\s*var\(--scrollbar-size\)/)
  assert.match(indexCss, /\*\s*::-webkit-scrollbar-thumb\s*\{[\s\S]*background-clip:\s*padding-box/)
  assert.match(indexCss, /\*\s*::-webkit-scrollbar-thumb:hover\s*\{[\s\S]*--scrollbar-thumb-current:/)
  assert.match(indexCss, /\*\s*::-webkit-scrollbar-corner\s*\{[\s\S]*background:\s*var\(--scrollbar-corner\)/)
})
