import type { RagIndexRequest, RagQueryRequest, RagSourceSummary, RagIndexResult, RagQueryResult } from './types.ts'

interface IpcMainLike {
  handle: (channel: string, handler: (...args: unknown[]) => unknown) => void
}

interface DialogLike {
  showOpenDialog: (options: {
    title: string
    properties: Array<'openFile' | 'multiSelections'>
    filters: Array<{ name: string; extensions: string[] }>
  }) => Promise<{ canceled: boolean; filePaths: string[] }>
}

interface RagServiceLike {
  listSources: () => Promise<RagSourceSummary[]>
  removeSource: (sourceId: string) => Promise<RagSourceSummary[]>
  clearSources: () => Promise<RagSourceSummary[]>
  indexFiles: (request: RagIndexRequest) => Promise<RagIndexResult>
  query: (request: RagQueryRequest) => Promise<RagQueryResult>
}

export interface RegisterRagIpcOptions {
  dialog?: DialogLike
}

export function registerRagIpc(
  ipcMainLike: IpcMainLike,
  service: RagServiceLike,
  options: RegisterRagIpcOptions = {}
): void {
  ipcMainLike.handle('rag:select-files', async () => {
    if (!options.dialog) {
      throw new Error('File dialog is not available')
    }

    const result = await options.dialog.showOpenDialog({
      title: '选择知识库文件',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Text Documents',
          extensions: [
            'txt',
            'md',
            'markdown',
            'json',
            'jsonl',
            'csv',
            'tsv',
            'log',
            'xml',
            'html',
            'yaml',
            'yml',
            'js',
            'jsx',
            'ts',
            'tsx',
            'css',
            'py',
            'java',
            'go',
            'rs',
            'c',
            'cpp',
            'h',
          ],
        },
      ],
    })

    return result.canceled ? [] : result.filePaths
  })

  ipcMainLike.handle('rag:list-sources', () => service.listSources())
  ipcMainLike.handle('rag:remove-source', (_event, sourceId) =>
    service.removeSource(String(sourceId))
  )
  ipcMainLike.handle('rag:clear-sources', () => service.clearSources())
  ipcMainLike.handle('rag:index-files', (_event, request) => service.indexFiles(request as RagIndexRequest))
  ipcMainLike.handle('rag:query', (_event, request) => service.query(request as RagQueryRequest))
}
