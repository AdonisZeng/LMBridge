import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const chatDir = dirname(fileURLToPath(import.meta.url))

test('chat workspace keeps a 200% slide track with half-width panes', () => {
  const workspace = readFileSync(join(chatDir, 'ChatWorkspace.tsx'), 'utf8')

  assert.match(
    workspace,
    /'flex h-full w-\[200%\] transition-transform duration-500 ease-\[cubic-bezier\(0\.22,1,0\.36,1\)\]'/
  )

  const halfWidthPaneMatches = workspace.match(/className="flex min-h-0 w-1\/2 flex-col"/g) ?? []
  assert.equal(
    halfWidthPaneMatches.length,
    2,
    'the chat and agent panes should each occupy half of the 200% slide track'
  )
})
