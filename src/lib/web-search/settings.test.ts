import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_WEB_SEARCH_CONFIG,
  normalizeWebSearchConfig,
} from './settings.ts'

test('default web search config uses brave with disabled state', () => {
  assert.deepEqual(DEFAULT_WEB_SEARCH_CONFIG, {
    enabled: false,
    provider: 'brave',
    baseURL: 'https://api.search.brave.com/res/v1/web/search',
    apiKey: '',
    maxResults: 5,
    country: 'US',
    language: 'en',
    safeSearch: 'moderate',
    timeoutMs: 8000,
  })
})

test('normalize web search config clamps numeric fields and fills defaults', () => {
  assert.deepEqual(
    normalizeWebSearchConfig({
      enabled: true,
      provider: 'searxng',
      baseURL: 'http://localhost:8080',
      apiKey: '',
      maxResults: 99,
      country: '',
      language: '',
      safeSearch: 'strict',
      timeoutMs: 0,
    }),
    {
      enabled: true,
      provider: 'searxng',
      baseURL: 'http://localhost:8080',
      apiKey: '',
      maxResults: 8,
      country: 'US',
      language: 'en',
      safeSearch: 'strict',
      timeoutMs: 8000,
    }
  )
})
