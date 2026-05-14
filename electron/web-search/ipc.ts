import type { WebSearchQueryRequest, WebSearchQueryResult } from './types.ts'

interface IpcMainLike {
  handle: (channel: string, handler: (...args: unknown[]) => unknown) => void
}

interface WebSearchServiceLike {
  query: (request: WebSearchQueryRequest) => Promise<WebSearchQueryResult>
}

export function registerWebSearchIpc(
  ipcMainLike: IpcMainLike,
  service: WebSearchServiceLike
): void {
  ipcMainLike.handle('web-search:query', (_event, request) =>
    service.query(request as WebSearchQueryRequest)
  )
}
