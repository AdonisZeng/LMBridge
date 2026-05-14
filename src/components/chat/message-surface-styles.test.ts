import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getAvatarClass,
  getMessageBubbleClass,
  getMessageColumnClass,
  getMessageRowClass,
} from './message-surface-styles.ts'

test('assistant rows keep a wider reading column with tighter bubble padding', () => {
  const row = getMessageRowClass('assistant')
  const column = getMessageColumnClass('assistant')
  const bubble = getMessageBubbleClass('assistant')

  assert.ok(row.includes('items-start'))
  assert.ok(column.includes('max-w-[min(42rem,78%)]'))
  assert.ok(bubble.includes('px-4'))
  assert.ok(bubble.includes('py-3'))
  assert.ok(bubble.includes('rounded-[22px]'))
  assert.ok(bubble.includes('dark:bg-black'))
})

test('user rows reverse alignment and keep a denser footprint', () => {
  const row = getMessageRowClass('user')
  const column = getMessageColumnClass('user')
  const bubble = getMessageBubbleClass('user')

  assert.ok(row.includes('flex-row-reverse'))
  assert.ok(column.includes('items-end'))
  assert.ok(column.includes('max-w-[min(34rem,72%)]'))
  assert.ok(bubble.includes('rounded-[20px]'))
})

test('avatars stay compact enough to reduce wasted horizontal space', () => {
  const assistantAvatar = getAvatarClass('assistant')
  const userAvatar = getAvatarClass('user')

  assert.ok(assistantAvatar.includes('h-10'))
  assert.ok(assistantAvatar.includes('w-10'))
  assert.ok(userAvatar.includes('h-10'))
  assert.ok(userAvatar.includes('w-10'))
})
