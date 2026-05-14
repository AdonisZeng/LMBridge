export const rendererLogger = {
  info: (message: string, ...args: unknown[]) => {
    window.electronAPI?.log('info', message, ...args)
  },
  warn: (message: string, ...args: unknown[]) => {
    window.electronAPI?.log('warn', message, ...args)
  },
  error: (message: string, ...args: unknown[]) => {
    window.electronAPI?.log('error', message, ...args)
  },
}
