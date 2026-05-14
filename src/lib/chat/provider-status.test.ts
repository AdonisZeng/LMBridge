import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveImmediateChatConnectionStatus } from './provider-status.ts'
import type { ProviderConfig } from '../providers/types.ts'

test('returns null for non-anthropic providers (deferred to network probing)', () => {
  const config: ProviderConfig = {
    id: 'lmstudio',
    name: 'LMStudio',
    baseURL: 'http://localhost:1234/v1',
    apiKey: '',
    model: 'local-model',
    apiType: 'openai',
    enabled: true,
  }
  assert.equal(resolveImmediateChatConnectionStatus(config), null)
})
