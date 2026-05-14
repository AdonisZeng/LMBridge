import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const chatDir = dirname(fileURLToPath(import.meta.url))

test('chat card surfaces use pure black backgrounds in dark mode', () => {
  const files = {
    workspace: join(chatDir, 'ChatWorkspace.tsx'),
    stage: join(chatDir, 'stage-shell-styles.ts'),
    message: join(chatDir, 'message-surface-styles.ts'),
    thinking: join(chatDir, 'thinking-panel-styles.ts'),
    composer: join(chatDir, 'composer-surface-styles.ts'),
  }

  const disallowedSurfaceBackgrounds: Array<[string, string]> = [
    [files.workspace, 'dark:hover:bg-slate-700/60'],
    [files.workspace, 'dark:bg-slate-900/60'],
    [files.workspace, 'dark:hover:bg-slate-800/70'],
    [files.stage, 'dark:bg-slate-950/46'],
    [files.stage, 'dark:bg-slate-950/34'],
    [files.stage, 'dark:bg-slate-900/58'],
    [files.stage, 'dark:bg-slate-900/80'],
    [files.stage, 'dark:hover:bg-slate-900/55'],
    [files.message, 'dark:bg-slate-900/74'],
    [files.thinking, 'dark:bg-slate-900/68'],
    [files.composer, 'dark:bg-slate-950/40'],
    [files.composer, 'dark:bg-slate-900/70'],
  ]

  for (const [file, oldClass] of disallowedSurfaceBackgrounds) {
    const content = readFileSync(file, 'utf8')
    assert.equal(
      content.includes(oldClass),
      false,
      `${file} should not use ${oldClass} for dark chat card surfaces`
    )
  }
})
