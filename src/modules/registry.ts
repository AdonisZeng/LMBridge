import { builtInModules } from './builtins'
import type { AppModuleDefinition, ModuleStateMap } from './types'

const moduleRegistry = [...builtInModules].sort((left, right) => left.order - right.order)

export function getAllModules(): AppModuleDefinition[] {
  return moduleRegistry
}

export function getModuleById(id: string): AppModuleDefinition | undefined {
  return moduleRegistry.find((module) => module.id === id)
}

export function resolveModuleEnabled(
  module: AppModuleDefinition,
  moduleStates: ModuleStateMap
): boolean {
  return moduleStates[module.id] ?? module.defaultEnabled ?? true
}

export function getEnabledModules(moduleStates: ModuleStateMap): AppModuleDefinition[] {
  return moduleRegistry.filter((module) => resolveModuleEnabled(module, moduleStates))
}
