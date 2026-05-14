import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const chatDir = dirname(fileURLToPath(import.meta.url))

test('chat workspace only auto-scrolls the active surface timeline', () => {
  const workspace = readFileSync(join(chatDir, 'ChatWorkspace.tsx'), 'utf8')

  assert.match(
    workspace,
    /scrollSurfaceTimelineToBottom\(\{\s*surfaceMode,\s*chatTimelineContainerRef,\s*agentTimelineContainerRef,\s*\}\)/s
  )
})

test('normal chat mode selector is disabled while the agent surface is active', () => {
  const workspace = readFileSync(join(chatDir, 'ChatWorkspace.tsx'), 'utf8')

  assert.match(workspace, /const isNormalModeToggleDisabled = surfaceMode === 'agent'/)
  assert.match(workspace, /disabled=\{isNormalModeToggleDisabled\}/)
  assert.match(workspace, /setNormalChatMode\(item\.id as 'chat' \| 'rag' \| 'web'\)/)
})

test('web search quick toggle is rendered on the left side of the composer', () => {
  const workspace = readFileSync(join(chatDir, 'ChatWorkspace.tsx'), 'utf8')

  assert.match(
    workspace,
    /<div className=\{getComposerRowClass\(\)\}>\s*<button[\s\S]*?title=\{normalChatMode === 'web' \? '关闭联网搜索' : '打开联网搜索'\}[\s\S]*?<Globe2 className="h-4 w-4" \/>[\s\S]*?<span>联网<\/span>[\s\S]*?<\/button>\s*<textarea/s
  )
})
