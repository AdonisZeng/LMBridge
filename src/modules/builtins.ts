import type { AppModuleDefinition } from './types'
import { agentModule } from './agent'
import { chatModule } from './chat'
import { ragModule } from './rag'

export const builtInModules: AppModuleDefinition[] = [
  chatModule,
  ragModule,
  agentModule,
]
