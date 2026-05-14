import { join } from 'path'

export interface ResolveAppIconPathInput {
  isDev: boolean
  cwd: string
  appPath: string
}

export function resolveAppIconPath({
  isDev,
  cwd,
  appPath,
}: ResolveAppIconPathInput): string {
  const basePath = isDev ? cwd : appPath
  return join(basePath, 'electron/assets/icon.ico')
}
