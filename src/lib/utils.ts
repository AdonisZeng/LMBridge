import { useEffect, useState } from 'react'
import { type ClassValue, clsx } from 'clsx'
import type { ProviderType } from '@/lib/providers'
import { useSettingsStore } from '@/lib/store'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ThinkingParseResult {
  thinking: string | null
  response: string
}

export function parseThinking(content: string): ThinkingParseResult {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi
  const parts = content.split(thinkRegex)

  if (parts.length > 1) {
    const thinking = parts[1]?.trim() || ''
    const response = parts[2]?.trim() || ''
    return { thinking: thinking || null, response }
  }

  const qwenThinkRegex = /<thinking_start>([\s\S]*?)<thinking_end>/gi
  const qwenParts = content.split(qwenThinkRegex)

  if (qwenParts.length > 1) {
    const thinking = qwenParts[1]?.trim() || ''
    const response = qwenParts[2]?.trim() || ''
    return { thinking: thinking || null, response }
  }

  return { thinking: null, response: content }
}

export function fileToBase64(file: File, stripPrefix = true): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(stripPrefix ? result.slice(result.indexOf(',') + 1) : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function useLocalStorageSync(_storeKey: string) {
  const [storageVersion, setStorageVersion] = useState(0)

  useEffect(() => {
    const handleStorageChange = () => {
      setStorageVersion((value) => value + 1)
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('focus', handleStorageChange)
    document.addEventListener('visibilitychange', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('focus', handleStorageChange)
      document.removeEventListener('visibilitychange', handleStorageChange)
    }
  }, [])

  return storageVersion
}

export function useRefreshSettings() {
  const { updateProvider, setActiveProvider, decryptApiKeys } = useSettingsStore()
  const storageVersion = useLocalStorageSync('ai-box-settings')

  useEffect(() => {
    if (storageVersion === 0) {
      return
    }

    let cancelled = false
    const refreshSettings = async () => {
      try {
        const stored = localStorage.getItem('ai-box-settings')
        if (!stored) {
          return
        }

        const parsed = JSON.parse(stored)
        if (parsed.state?.providers) {
          await Promise.all(
            parsed.state.providers.map((provider: { id: string; [key: string]: unknown }) => {
              const { id, ...updates } = provider
              return updateProvider(id as ProviderType, updates)
            })
          )
        }

        if (parsed.state?.activeProviders?.text) {
          setActiveProvider('text', parsed.state.activeProviders.text as ProviderType)
        } else if (parsed.state?.activeProvider) {
          setActiveProvider('text', parsed.state.activeProvider as ProviderType)
        }

        if (!cancelled) {
          await decryptApiKeys()
        }
      } catch (error) {
        console.error('Failed to refresh settings:', error)
      }
    }

    void refreshSettings()
    return () => {
      cancelled = true
    }
  }, [storageVersion, updateProvider, setActiveProvider, decryptApiKeys])
}
