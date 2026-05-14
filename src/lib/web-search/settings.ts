import type { WebSearchConfig } from '@/types/web-search'

export const DEFAULT_WEB_SEARCH_CONFIG: WebSearchConfig = {
  enabled: false,
  provider: 'brave',
  baseURL: 'https://api.search.brave.com/res/v1/web/search',
  apiKey: '',
  maxResults: 5,
  country: 'US',
  language: 'en',
  safeSearch: 'moderate',
  timeoutMs: 8000,
}

export function normalizeWebSearchConfig(config: Partial<WebSearchConfig> | undefined): WebSearchConfig {
  const merged = {
    ...DEFAULT_WEB_SEARCH_CONFIG,
    ...(config ?? {}),
  }

  return {
    ...merged,
    baseURL:
      typeof merged.baseURL === 'string'
        ? merged.baseURL.trim()
        : DEFAULT_WEB_SEARCH_CONFIG.baseURL,
    apiKey: typeof merged.apiKey === 'string' ? merged.apiKey : '',
    maxResults: Math.min(8, Math.max(1, Number(merged.maxResults) || DEFAULT_WEB_SEARCH_CONFIG.maxResults)),
    country:
      typeof merged.country === 'string' && merged.country.trim()
        ? merged.country.trim().toUpperCase()
        : DEFAULT_WEB_SEARCH_CONFIG.country,
    language:
      typeof merged.language === 'string' && merged.language.trim()
        ? merged.language.trim().toLowerCase()
        : DEFAULT_WEB_SEARCH_CONFIG.language,
    timeoutMs:
      Number(merged.timeoutMs) > 0
        ? Number(merged.timeoutMs)
        : DEFAULT_WEB_SEARCH_CONFIG.timeoutMs,
  }
}
