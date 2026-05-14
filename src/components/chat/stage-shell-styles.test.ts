import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getStageShellClass,
  getStageStatusClusterClass,
  getStageToolbarClass,
  getStageWorkspaceBackdropClass,
  getSessionTabClass,
} from './stage-shell-styles.ts'

test('workspace backdrop creates the spotlight-stage atmosphere', () => {
  const className = getStageWorkspaceBackdropClass()

  assert.ok(className.includes('relative'))
  assert.ok(className.includes('overflow-hidden'))
  assert.ok(className.includes('bg-[radial-gradient('))
  assert.ok(className.includes('dark:bg-[radial-gradient('))
})

test('stage shell centers the conversation in a premium container', () => {
  const className = getStageShellClass()

  assert.ok(className.includes('mx-auto'))
  assert.ok(className.includes('max-w-5xl'))
  assert.ok(className.includes('rounded-[28px]'))
  assert.ok(className.includes('backdrop-blur-xl'))
  assert.ok(className.includes('dark:bg-black'))
})

test('toolbar and status cluster stay visually light', () => {
  assert.ok(getStageToolbarClass().includes('border-b'))
  assert.ok(getStageToolbarClass().includes('bg-white/72'))
  assert.ok(getStageToolbarClass().includes('dark:bg-black'))
  assert.ok(getStageStatusClusterClass().includes('rounded-full'))
  assert.ok(getStageStatusClusterClass().includes('text-slate-500'))
  assert.ok(getStageStatusClusterClass().includes('dark:bg-black'))
})

test('active and inactive session tabs diverge in emphasis', () => {
  const active = getSessionTabClass(true)
  const inactive = getSessionTabClass(false)

  assert.ok(active.includes('bg-white/88'))
  assert.ok(active.includes('shadow-sm'))
  assert.ok(active.includes('dark:bg-black'))
  assert.ok(inactive.includes('hover:bg-white/60'))
  assert.ok(inactive.includes('dark:hover:bg-black'))
  assert.ok(inactive.includes('text-slate-500'))
})
