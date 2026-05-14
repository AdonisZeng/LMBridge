import type { ProviderConfig } from '../providers/types.ts'

export type ChatConnectionStatus = 'connected' | 'disconnected' | 'unknown'

export function resolveImmediateChatConnectionStatus(
  config: ProviderConfig | undefined
): ChatConnectionStatus | null {
  if (!config || !config.baseURL) {
    return 'unknown'
  }

  if (!config.enabled) {
    return 'disconnected'
  }

  if (config.apiType !== 'anthropic') {
    return null
  }

  return hasConfiguredApiKey(config.apiKey) ? 'connected' : 'disconnected'
}

function hasConfiguredApiKey(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { encrypted?: unknown }).encrypted === true &&
    typeof (value as { data?: unknown }).data === 'string' &&
    Boolean((value as { data: string }).data.trim())
  )
}
