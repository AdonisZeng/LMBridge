import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const supportedOpacity = new Set([
  '0',
  '5',
  '10',
  '20',
  '25',
  '30',
  '40',
  '50',
  '60',
  '70',
  '75',
  '80',
  '90',
  '95',
  '100',
])

const agentDir = dirname(fileURLToPath(import.meta.url))
const workspaceDir = dirname(agentDir)
const componentsDir = dirname(workspaceDir)
const files = [
  join(workspaceDir, 'AgentWorkspace.tsx'),
  join(componentsDir, 'chat', 'composer-surface-styles.ts'),
  join(agentDir, 'AgentActivityCard.tsx'),
  join(agentDir, 'AgentChatTimeline.tsx'),
  join(agentDir, 'AgentComposer.tsx'),
  join(agentDir, 'AgentContextRail.tsx'),
]

test('agent theme classes use Tailwind-supported opacity modifiers', () => {
  const unsupported: string[] = []
  const classPattern =
    /(?:^|\s|['"`])(?:dark:|hover:|disabled:|group-hover:|active:|focus:)*[-\w:[\]#]+\/(\d{1,3})(?=\s|['"`),])/g

  for (const file of files) {
    const content = readFileSync(file, 'utf8')

    for (const match of content.matchAll(classPattern)) {
      const token = match[0].trim().replace(/^['"`]/, '')
      const opacity = match[1] ?? ''
      if (!supportedOpacity.has(opacity)) {
        unsupported.push(`${file}: ${token}`)
      }
    }
  }

  assert.deepEqual(unsupported, [])
})

test('agent card surfaces use pure black backgrounds in dark mode', () => {
  const surfaceFiles = {
    workspace: join(workspaceDir, 'AgentWorkspace.tsx'),
    composerSurface: join(componentsDir, 'chat', 'composer-surface-styles.ts'),
    activity: join(agentDir, 'AgentActivityCard.tsx'),
    timeline: join(agentDir, 'AgentChatTimeline.tsx'),
    composer: join(agentDir, 'AgentComposer.tsx'),
    rail: join(agentDir, 'AgentContextRail.tsx'),
  }

  const disallowedSurfaceBackgrounds: Array<[string, string]> = [
    [surfaceFiles.workspace, 'dark:bg-slate-950/50'],
    [surfaceFiles.workspace, 'dark:bg-slate-950/40'],
    [surfaceFiles.workspace, 'dark:bg-slate-900/60'],
    [surfaceFiles.composerSurface, 'dark:bg-slate-950/40'],
    [surfaceFiles.composerSurface, 'dark:bg-slate-900/70'],
    [surfaceFiles.activity, 'dark:bg-sky-950/40'],
    [surfaceFiles.activity, 'dark:bg-sky-950/70'],
    [surfaceFiles.activity, 'dark:bg-slate-900/70'],
    [surfaceFiles.activity, 'dark:bg-amber-950/40'],
    [surfaceFiles.activity, 'dark:bg-amber-950/30'],
    [surfaceFiles.activity, 'dark:hover:bg-amber-900/40'],
    [surfaceFiles.timeline, 'dark:bg-slate-900/60'],
    [surfaceFiles.timeline, 'dark:bg-red-950/40'],
    [surfaceFiles.timeline, 'dark:bg-slate-900/70'],
    [surfaceFiles.composer, 'dark:bg-slate-900/60'],
    [surfaceFiles.composer, 'dark:hover:bg-slate-800'],
    [surfaceFiles.rail, 'dark:bg-slate-950/20'],
    [surfaceFiles.rail, 'dark:bg-slate-900/50'],
    [surfaceFiles.rail, 'dark:bg-slate-900/40'],
    [surfaceFiles.rail, 'dark:bg-slate-900/30'],
    [surfaceFiles.rail, 'dark:bg-sky-950/40'],
  ]

  for (const [file, oldClass] of disallowedSurfaceBackgrounds) {
    const content = readFileSync(file, 'utf8')
    assert.equal(
      content.includes(oldClass),
      false,
      `${file} should not use ${oldClass} for dark card surfaces`
    )
  }

  assert.match(
    readFileSync(surfaceFiles.rail, 'utf8'),
    /bg-\[#4a9eff\]\/10[^'"]*dark:bg-black/,
    'active mode cards should keep pure black backgrounds in dark mode'
  )
})
