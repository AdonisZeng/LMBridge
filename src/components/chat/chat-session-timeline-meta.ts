import type { Message } from '@/lib/providers'

export interface TimelineSourceItem {
  id: string
  label: string
  url?: string
  title: string
}

export function getSourceItems(message: Pick<Message, 'sources'>): TimelineSourceItem[] {
  return (message.sources ?? []).map((source) => ({
    id: source.id,
    label: source.name,
    url: source.url,
    title: source.snippet || source.name,
  }))
}

export function getAgentOriginBadge(message: Pick<Message, 'origin'>): string | null {
  return message.origin === 'agent' ? 'Agent' : null
}
