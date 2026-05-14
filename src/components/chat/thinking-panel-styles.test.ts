import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getThinkingBodyClass,
  getThinkingPanelClass,
  getThinkingWrapperClass,
} from './thinking-panel-styles.ts'

test('expanded thinking wrapper keeps the new attached spacing', () => {
  const className = getThinkingWrapperClass(true)

  assert.ok(className.includes('max-h-[70vh]'))
  assert.ok(className.includes('mt-2'))
})

test('thinking panel uses the premium stage card treatment', () => {
  const className = getThinkingPanelClass()

  assert.ok(className.includes('rounded-2xl'))
  assert.ok(className.includes('backdrop-blur-xl'))
  assert.ok(className.includes('border-slate-200/80'))
  assert.ok(className.includes('dark:bg-black'))
})

test('thinking body still scrolls long reasoning content', () => {
  const className = getThinkingBodyClass()

  assert.ok(className.includes('overflow-y-auto'))
  assert.ok(className.includes('max-h-[60vh]'))
})
