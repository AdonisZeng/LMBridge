import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  log: (level: string, message: string, ...args: unknown[]) =>
    ipcRenderer.invoke('log-message', level, message, ...args),
  crypto: {
    encrypt: (plaintext: string) => ipcRenderer.invoke('encrypt-string', plaintext),
    decrypt: (encryptedBase64: string) => ipcRenderer.invoke('decrypt-string', encryptedBase64),
    isAvailable: () => ipcRenderer.invoke('is-encryption-available'),
  },
  agent: {
    startTask: (request: unknown) => ipcRenderer.invoke('agent:start-task', request),
    getTaskState: (taskId: string) => ipcRenderer.invoke('agent:get-task-state', taskId),
    approveAction: (taskId: string, actionId: string) =>
      ipcRenderer.invoke('agent:approve-action', taskId, actionId),
    rejectAction: (taskId: string, actionId: string) =>
      ipcRenderer.invoke('agent:reject-action', taskId, actionId),
    cancelTask: (taskId: string) => ipcRenderer.invoke('agent:cancel-task', taskId),
    onTaskEvent: (listener: (event: unknown) => void) => {
      const wrapped = (_event: unknown, payload: unknown) => listener(payload)
      ipcRenderer.on('agent:task-event', wrapped)
      return () => ipcRenderer.removeListener('agent:task-event', wrapped)
    },
  },
  chat: {
    complete: (request: unknown) => ipcRenderer.invoke('chat:complete', request),
    abort: (requestId: number) => ipcRenderer.invoke('chat:abort', requestId),
    onChunk: (listener: (event: unknown) => void) => {
      const wrapped = (_event: unknown, payload: unknown) => listener(payload)
      ipcRenderer.on('chat:chunk', wrapped)
      return () => ipcRenderer.removeListener('chat:chunk', wrapped)
    },
  },
  rag: {
    selectFiles: () => ipcRenderer.invoke('rag:select-files'),
    listSources: () => ipcRenderer.invoke('rag:list-sources'),
    removeSource: (sourceId: string) => ipcRenderer.invoke('rag:remove-source', sourceId),
    clearSources: () => ipcRenderer.invoke('rag:clear-sources'),
    indexFiles: (request: unknown) => ipcRenderer.invoke('rag:index-files', request),
    query: (request: unknown) => ipcRenderer.invoke('rag:query', request),
  },
  webSearch: {
    query: (request: unknown) => ipcRenderer.invoke('web-search:query', request),
  },
})
