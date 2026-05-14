import type { LucideIcon } from 'lucide-react'
import { MessageSquare, Settings } from 'lucide-react'

export type AppView = 'chat' | 'settings'

export interface AppNavigationItem {
  id: AppView
  label: string
  icon: LucideIcon
}

export const DEFAULT_APP_VIEW: AppView = 'chat'

export const APP_NAVIGATION_ITEMS: AppNavigationItem[] = [
  {
    id: 'chat',
    label: '聊天',
    icon: MessageSquare,
  },
  {
    id: 'settings',
    label: '设置',
    icon: Settings,
  },
]
