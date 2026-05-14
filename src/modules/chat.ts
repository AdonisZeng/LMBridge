import { lazy } from 'react'
import { MessageSquare } from 'lucide-react'
import type { AppModuleDefinition } from './types'

export const chatModule: AppModuleDefinition = {
  id: 'chat',
  label: '聊天',
  description: '多会话聊天、Markdown 渲染和推理过程展示。',
  category: 'assistant',
  icon: MessageSquare,
  order: 10,
  defaultEnabled: true,
  canDisable: true,
  tags: ['llm', 'chat', 'markdown'],
  Workspace: lazy(async () => {
    const module = await import('@/components/chat/ChatWorkspace')
    return { default: module.ChatWorkspace }
  }),
}
