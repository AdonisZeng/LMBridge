import type { MessageSource } from '@/lib/providers'
import type { RagSearchResult } from '@/types/rag'
import type { WebSearchResult } from '@/types/web-search'

export type ChatSendMode = 'chat' | 'rag' | 'web' | 'agent'

export function resolveChatSendMode(input: {
  isAgentMode: boolean
  isRagEnabled: boolean
  isWebSearchEnabled: boolean
}): ChatSendMode {
  if (input.isAgentMode) {
    return 'agent'
  }

  if (input.isWebSearchEnabled) {
    return 'web'
  }

  return input.isRagEnabled ? 'rag' : 'chat'
}

export function buildMessageSources(matches: RagSearchResult[]): MessageSource[] {
  const seenSourceIds = new Set<string>()
  const sources: MessageSource[] = []

  for (const match of matches) {
    if (seenSourceIds.has(match.chunk.sourceId)) {
      continue
    }

    seenSourceIds.add(match.chunk.sourceId)
    sources.push({
      id: match.chunk.sourceId,
      name: match.chunk.sourceName,
      provider: 'rag',
    })
  }

  return sources
}

export function buildWebMessageSources(results: WebSearchResult[]): MessageSource[] {
  const seenUrls = new Set<string>()
  const sources: MessageSource[] = []

  for (const result of results) {
    const normalizedUrl = normalizeCitationUrl(result.url)
    if (!normalizedUrl || seenUrls.has(normalizedUrl)) {
      continue
    }

    seenUrls.add(normalizedUrl)
    sources.push({
      id: `web-${sources.length + 1}`,
      name: result.title,
      url: normalizedUrl,
      snippet: result.snippet,
      ...(result.publishedAt ? { publishedAt: result.publishedAt } : {}),
      provider: 'web',
    })
  }

  return sources
}

function normalizeCitationUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }

    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_')) {
        url.searchParams.delete(key)
      }
    }

    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}
