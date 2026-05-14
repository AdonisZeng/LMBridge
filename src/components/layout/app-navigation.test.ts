import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { APP_NAVIGATION_ITEMS, DEFAULT_APP_VIEW } from './app-navigation.ts'

test('exposes a fixed chat/settings navigation model', () => {
  assert.equal(DEFAULT_APP_VIEW, 'chat')
  assert.deepEqual(
    APP_NAVIGATION_ITEMS.map((item) => item.id),
    ['chat', 'settings']
  )
  assert.deepEqual(
    APP_NAVIGATION_ITEMS.map((item) => item.label),
    ['聊天', '设置']
  )
})
