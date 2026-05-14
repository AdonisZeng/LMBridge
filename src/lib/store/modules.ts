import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getModuleById } from '@/modules'
import type { ModuleStateMap } from '@/modules'

interface ModuleStoreState {
  moduleStates: ModuleStateMap
  setModuleEnabled: (moduleId: string, enabled: boolean) => void
  toggleModule: (moduleId: string) => void
  isModuleEnabled: (moduleId: string) => boolean
}

export const useModuleStore = create<ModuleStoreState>()(
  persist(
    (set, get) => ({
      moduleStates: {},

      setModuleEnabled: (moduleId: string, enabled: boolean) => {
        const module = getModuleById(moduleId)
        if (!module) {
          return
        }

        set((state) => ({
          moduleStates: {
            ...state.moduleStates,
            [moduleId]: enabled,
          },
        }))
      },

      toggleModule: (moduleId: string) => {
        const enabled = get().isModuleEnabled(moduleId)
        get().setModuleEnabled(moduleId, !enabled)
      },

      isModuleEnabled: (moduleId: string) => {
        const module = getModuleById(moduleId)
        if (!module) {
          return false
        }

        return get().moduleStates[moduleId] ?? module.defaultEnabled ?? true
      },
    }),
    {
      name: 'ai-box-modules',
    }
  )
)
