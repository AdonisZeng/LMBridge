import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyThemeToDocument } from './theme.ts'

function createClassList(initialClasses: string[] = []) {
  const classes = new Set(initialClasses)

  return {
    add: (...tokens: string[]) => {
      tokens.forEach((token) => classes.add(token))
    },
    remove: (...tokens: string[]) => {
      tokens.forEach((token) => classes.delete(token))
    },
    has: (token: string) => classes.has(token),
  }
}

test('applies the selected theme to both documentElement and body', () => {
  const documentElementClassList = createClassList(['light'])
  const bodyClassList = createClassList(['light'])

  applyThemeToDocument('dark', {
    documentElement: { classList: documentElementClassList },
    body: { classList: bodyClassList },
  })

  assert.equal(documentElementClassList.has('dark'), true)
  assert.equal(documentElementClassList.has('light'), false)
  assert.equal(bodyClassList.has('dark'), true)
  assert.equal(bodyClassList.has('light'), false)
})
