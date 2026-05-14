import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProviderConfig, ProviderType, ProviderCategory } from '@/lib/providers'
import type { WebSearchConfig } from '@/types/web-search'
import { getDefaultProviders } from '@/lib/providers'
import { encrypt, decrypt, isEncryptedValue } from '@/lib/crypto'
import { DEFAULT_WEB_SEARCH_CONFIG, normalizeWebSearchConfig } from '@/lib/web-search/settings'

interface SettingsState {
  providers: ProviderConfig[]
  activeProviders: Record<ProviderCategory, ProviderType>
  theme: 'light' | 'dark'
  webSearch: WebSearchConfig
  _decryptedKeys: Record<string, string>
  _decryptedWebSearchApiKey: string

  updateProvider: (id: ProviderType, updates: Partial<ProviderConfig>) => Promise<void>
  updateWebSearch: (updates: Partial<WebSearchConfig>) => Promise<void>
  setActiveProvider: (category: ProviderCategory, id: ProviderType) => void
  setTheme: (theme: 'light' | 'dark') => void
  getProviderConfig: (id: ProviderType) => ProviderConfig | undefined
  decryptApiKeys: () => Promise<void>
  decryptWebSearchApiKey: () => Promise<void>
  getDecryptedApiKey: (providerId: ProviderType) => string
  getRunnableWebSearchConfig: () => WebSearchConfig
}

const defaultProviders = getDefaultProviders()

const defaultActiveProviders: Record<ProviderCategory, ProviderType> = {
  text: 'lmstudio',
}

function normalizeProviders(
  providers: ProviderConfig[]
): ProviderConfig[] {
  return providers.map((p) => {
    const def = defaultProviders.find((d) => d.id === p.id)
    if (!def) return p
    const merged = { ...def, ...p }
    return merged
  })
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      providers: defaultProviders,
      activeProviders: defaultActiveProviders,
      theme: 'dark',
      webSearch: DEFAULT_WEB_SEARCH_CONFIG,
      _decryptedKeys: {},
      _decryptedWebSearchApiKey: '',

      updateProvider: async (id: ProviderType, updates: Partial<ProviderConfig>) => {
        let apiKey = updates.apiKey ?? ''
        if (apiKey && typeof apiKey === 'string') {
          const encrypted = await encrypt(apiKey)
          if (encrypted) {
            apiKey = encrypted as unknown as string
          }
        }

        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, ...updates, apiKey } : p
          ),
        }))
      },

      updateWebSearch: async (updates: Partial<WebSearchConfig>) => {
        const nextWebSearch = {
          ...get().webSearch,
          ...updates,
        }

        if (typeof updates.apiKey === 'string') {
          const encrypted = await encrypt(updates.apiKey)
          if (encrypted) {
            nextWebSearch.apiKey = encrypted
          }
        }

        set((state) => ({
          webSearch: normalizeWebSearchConfig(nextWebSearch),
          _decryptedWebSearchApiKey:
            typeof updates.apiKey === 'string'
              ? updates.apiKey
              : state._decryptedWebSearchApiKey,
        }))
      },

      setActiveProvider: (category: ProviderCategory, id: ProviderType) => {
        set((state) => {
          const next = {
            activeProviders: { ...state.activeProviders, [category]: id },
            providers: state.providers.map((p) =>
              p.id === id && !p.enabled ? { ...p, enabled: true } : p
            ),
          }
          return next
        })
      },

      setTheme: (theme: 'light' | 'dark') => {
        set({ theme })
      },

      getProviderConfig: (id: ProviderType) => {
        return get().providers.find((p) => p.id === id)
      },

      decryptApiKeys: async () => {
        const { providers, _decryptedKeys } = get()
        const newDecrypted: Record<string, string> = { ..._decryptedKeys }
        const updatedProviders: ProviderConfig[] = []

        for (const p of providers) {
          const cached = newDecrypted[p.id]
          if (cached !== undefined && !isEncryptedValue(p.apiKey)) {
            // Cache is valid (plaintext stored) and provider hasn't changed to encrypted
            updatedProviders.push({ ...p, apiKey: cached })
          } else if (isEncryptedValue(p.apiKey)) {
            // Encrypted — decrypt and cache
            const decrypted = await decrypt(p.apiKey)
            const key = decrypted ?? ''
            newDecrypted[p.id] = key
            updatedProviders.push({ ...p, apiKey: key })
          } else {
            // Plaintext, no cache entry needed
            updatedProviders.push(p)
          }
        }

        set({ providers: updatedProviders, _decryptedKeys: newDecrypted })
      },

      getDecryptedApiKey: (providerId: ProviderType) => {
        const { _decryptedKeys, providers } = get()
        const p = providers.find((pr) => pr.id === providerId)
        if (!p) return ''
        if (_decryptedKeys[providerId] !== undefined) return _decryptedKeys[providerId]
        if (isEncryptedValue(p.apiKey)) return ''
        return p.apiKey
      },

      decryptWebSearchApiKey: async () => {
        const { webSearch } = get()
        if (!isEncryptedValue(webSearch.apiKey)) {
          set({ _decryptedWebSearchApiKey: webSearch.apiKey })
          return
        }

        const decrypted = await decrypt(webSearch.apiKey)
        set({ _decryptedWebSearchApiKey: decrypted ?? '' })
      },

      getRunnableWebSearchConfig: () => {
        const { webSearch, _decryptedWebSearchApiKey } = get()
        return normalizeWebSearchConfig({
          ...webSearch,
          apiKey:
            _decryptedWebSearchApiKey ||
            (isEncryptedValue(webSearch.apiKey) ? '' : webSearch.apiKey),
        })
      },
    }),
    {
      name: 'ai-box-settings',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<SettingsState> & { activeProvider?: string } | undefined
        if (!persisted) return currentState

        const mergedProviders = persisted.providers
          ? normalizeProviders(persisted.providers as ProviderConfig[])
          : currentState.providers

        // Migrate old single activeProvider to new activeProviders
        // New activeProviders takes precedence; old field is dropped
        let activeProviders = currentState.activeProviders
        if (persisted.activeProviders) {
          activeProviders = {
            ...currentState.activeProviders,
            text: persisted.activeProviders.text ?? currentState.activeProviders.text,
          }
        } else if (persisted.activeProvider && typeof persisted.activeProvider === 'string') {
          activeProviders = {
            ...currentState.activeProviders,
            text: persisted.activeProvider as ProviderType,
          }
        }

        // Build decrypted keys cache from persisted encrypted values
        const decryptedKeys: Record<string, string> = {}
        for (const p of mergedProviders) {
          if (isEncryptedValue(p.apiKey)) {
            // Leave encrypted — decryptApiKeys() will be called post-hydration
            // Cache empty string as placeholder so getDecryptedApiKey returns ''
          } else if (p.apiKey) {
            decryptedKeys[p.id] = p.apiKey
          }
        }

        // Exclude stale activeProvider field from returned state
        const restPersisted = { ...persisted }
        delete restPersisted.activeProvider

        const webSearch = normalizeWebSearchConfig(
          persisted.webSearch as Partial<WebSearchConfig> | undefined
        )
        const decryptedWebSearchApiKey = isEncryptedValue(webSearch.apiKey) ? '' : webSearch.apiKey

        return {
          ...currentState,
          ...restPersisted,
          providers: mergedProviders,
          activeProviders,
          webSearch,
          _decryptedKeys: {
            ...decryptedKeys,
            ...(persisted._decryptedKeys || {}),
          },
          _decryptedWebSearchApiKey:
            typeof persisted._decryptedWebSearchApiKey === 'string'
              ? persisted._decryptedWebSearchApiKey
              : decryptedWebSearchApiKey,
        }
      },
    }
  )
)
