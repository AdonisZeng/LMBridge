import { lazy } from 'react'
import { Briefcase } from 'lucide-react'
import type { AppModuleDefinition } from './types'

export const agentModule: AppModuleDefinition = {
  id: 'agent',
  label: 'Agent',
  description: '面向未来 Agent 技能装配与编排的工作区。',
  category: 'automation',
  icon: Briefcase,
  order: 20,
  defaultEnabled: true,
  canDisable: true,
  tags: ['agent', 'workflow', 'skills'],
  Workspace: lazy(async () => {
    const module = await import('@/components/workspace/AgentWorkspace')
    return { default: module.AgentWorkspace }
  }),
}
