import { lazy } from 'react'
import { DatabaseZap } from 'lucide-react'
import type { AppModuleDefinition } from './types'

export const ragModule: AppModuleDefinition = {
  id: 'rag',
  label: '知识库',
  description: '上传文本文件并用 LMStudio 嵌入模型构建本地 RAG 知识库。',
  category: 'assistant',
  icon: DatabaseZap,
  order: 15,
  defaultEnabled: true,
  canDisable: true,
  tags: ['rag', 'knowledge-base', 'lmstudio'],
  Workspace: lazy(async () => {
    const module = await import('@/components/rag/RagWorkspace')
    return { default: module.RagWorkspace }
  }),
}
