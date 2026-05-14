import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getComposerActionButtonClass,
  getComposerRowClass,
  getComposerShellClass,
  getComposerTextareaClass,
} from './composer-surface-styles.ts'

test('composer shell docks into the bottom of the stage', () => {
  const className = getComposerShellClass()

  assert.ok(className.includes('mt-auto'))
  assert.ok(className.includes('border-t'))
  assert.ok(className.includes('backdrop-blur-xl'))
})

test('composer row keeps the input compact but premium', () => {
  const row = getComposerRowClass()
  const textarea = getComposerTextareaClass()

  assert.ok(row.includes('rounded-[24px]'))
  assert.ok(row.includes('shadow-[0_18px_40px_rgba(148,163,184,0.14)]'))
  assert.ok(textarea.includes('min-h-[48px]'))
  assert.ok(textarea.includes('px-4'))
})

test('send and stop buttons diverge by intent and disabled state', () => {
  const send = getComposerActionButtonClass('send', false)
  const stop = getComposerActionButtonClass('stop', false)
  const disabled = getComposerActionButtonClass('send', true)

  assert.ok(send.includes('from-[#4a9eff]'))
  assert.ok(stop.includes('bg-[#dc2626]'))
  assert.ok(disabled.includes('cursor-not-allowed'))
})
