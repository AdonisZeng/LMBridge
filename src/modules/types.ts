import type { ComponentType, LazyExoticComponent } from 'react'
import type { LucideIcon } from 'lucide-react'

export type AppModuleCategory = 'assistant' | 'automation' | 'integration'

export type ModuleWorkspaceComponent = LazyExoticComponent<ComponentType<Record<string, never>>>

export interface AppModuleDefinition {
  id: string
  label: string
  description: string
  category: AppModuleCategory
  icon: LucideIcon
  order: number
  defaultEnabled?: boolean
  canDisable?: boolean
  tags?: string[]
  Workspace: ModuleWorkspaceComponent
}

export type ModuleStateMap = Record<string, boolean>
