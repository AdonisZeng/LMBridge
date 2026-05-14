import { app, shell, BrowserWindow, ipcMain, safeStorage, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAgentIpc } from './agent/ipc'
import { AgentRuntime } from './agent/runtime'
import { TaskSessionManager } from './agent/task-session-manager'
import { SkillRegistry } from './agent/skill-registry'
import { SkillExecutor } from './agent/skill-executor'
import { ToolBroker } from './agent/tool-broker'
import { RunnerManager } from './agent/runner-manager'
import { ApprovalGate } from './agent/approval-gate'
import { DefaultPlanner } from './agent/default-planner'
import { DefaultSubagentRunner } from './agent/subagent-runner'
import { HookRunner } from './agent/hook-runner'
import { MemoryStore } from './agent/memory-store'
import { RecoveryController } from './agent/recovery-controller'
import { TaskGraphStore } from './agent/task-graph-store'
import { BackgroundTaskManager } from './agent/background-task-manager'
import { ScheduleStore } from './agent/schedule-store'
import { logger } from './logger'
import { resolveAppIconPath } from './app-icon'
import { createProvider } from '../src/lib/providers/index'
import { migrateLegacyPaths } from './agent/migrate-legacy-paths'
import { registerChatIpc } from './chat-ipc'
import { RagService } from './rag/service'
import { registerRagIpc } from './rag/ipc'
import { WebSearchService } from './web-search/service'
import { registerWebSearchIpc } from './web-search/ipc'

let settingsWindow: BrowserWindow | null = null
const runnerManager = new RunnerManager()
const agentRuntime = new AgentRuntime({
  sessions: new TaskSessionManager(),
  planner: new DefaultPlanner({
    callModel: async (messages, input) => {
      if (!input.provider) {
        throw new Error('Planner provider is required.')
      }

      const provider = createProvider(input.provider)
      if (!provider) {
        throw new Error(`Could not create provider ${input.provider.id}`)
      }

      return provider.chat(messages)
    },
  }),
  skillRegistry: new SkillRegistry(),
  skillExecutor: new SkillExecutor({ runner: runnerManager }),
  toolBroker: new ToolBroker(),
  runner: runnerManager,
  approvalGate: new ApprovalGate(),
  hooks: new HookRunner(),
  memoryStore: new MemoryStore(),
  recovery: new RecoveryController(),
  taskGraph: new TaskGraphStore(),
  backgroundTasks: new BackgroundTaskManager({ runner: runnerManager }),
  scheduleStore: new ScheduleStore(),
  subagentRunner: new DefaultSubagentRunner({
    callModel: async (messages, input) => {
      const provider = createProvider(input.provider)
      if (!provider) {
        throw new Error(`Could not create provider ${input.provider.id}`)
      }

      return provider.chat(messages)
    },
  }),
})

function sendAgentEvent(channel: 'agent:task-event', payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload)
    }
  }
}

function createWindow(): void {
  logger.info('创建主窗口')
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: resolveAppIconPath({
      isDev: is.dev,
      cwd: process.cwd(),
      appPath: app.getAppPath(),
    }),
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    logger.info('主窗口 ready-to-show')
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = process.env['ELECTRON_RENDERER_URL']
    logger.info('主窗口加载开发URL', url)
    mainWindow.loadURL(url)
  } else {
    const filePath = join(__dirname, '../renderer/index.html')
    logger.info('主窗口加载文件', filePath)
    mainWindow.loadFile(filePath)
  }
}

function createSettingsWindow(): void {
  logger.info('createSettingsWindow 被调用')
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    logger.info('设置窗口已存在，聚焦')
    settingsWindow.focus()
    return
  }

  logger.info('开始创建设置窗口')
  settingsWindow = new BrowserWindow({
    width: 520,
    height: 640,
    minWidth: 400,
    minHeight: 500,
    icon: resolveAppIconPath({
      isDev: is.dev,
      cwd: process.cwd(),
      appPath: app.getAppPath(),
    }),
    show: false,
    autoHideMenuBar: true,
    parent: BrowserWindow.getAllWindows()[0] || undefined,
    modal: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  settingsWindow.on('ready-to-show', () => {
    logger.info('设置窗口 ready-to-show')
    settingsWindow?.show()
  })

  settingsWindow.on('closed', () => {
    logger.info('设置窗口 closed')
    settingsWindow = null
  })

  settingsWindow.webContents.on('did-finish-load', () => {
    logger.info('设置窗口 did-finish-load')
  })

  settingsWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    logger.error('设置窗口 did-fail-load', { errorCode, errorDescription })
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const rendererUrl = process.env['ELECTRON_RENDERER_URL']
    const baseUrl = rendererUrl.endsWith('/') ? rendererUrl.slice(0, -1) : rendererUrl
    const settingsUrl = `${baseUrl}/settings.html`
    logger.info('设置窗口加载开发URL', settingsUrl)
    settingsWindow.loadURL(settingsUrl)
  } else {
    const filePath = join(__dirname, '../renderer/settings.html')
    logger.info('设置窗口加载文件', filePath)
    settingsWindow.loadFile(filePath)
  }
}

migrateLegacyPaths()

app.whenReady().then(() => {
  logger.info('app.whenReady')
  electronApp.setAppUserModelId('com.aibox.app')
  registerAgentIpc(ipcMain, agentRuntime, {
    sendEvent: sendAgentEvent,
  })
  registerChatIpc(ipcMain, { createProvider })
  registerRagIpc(
    ipcMain,
    new RagService({
      dataDir: join(app.getPath('userData'), 'rag'),
      createProvider,
    }),
    { dialog }
  )
  registerWebSearchIpc(
    ipcMain,
    new WebSearchService({
      createProvider,
    })
  )

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('open-settings-window', () => {
    logger.info('IPC open-settings-window 被调用')
    createSettingsWindow()
  })

  ipcMain.handle('encrypt-string', (_, plaintext: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      return null
    }
    const encrypted = safeStorage.encryptString(plaintext)
    return encrypted.toString('base64')
  })

  ipcMain.handle('decrypt-string', (_, encryptedBase64: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      return null
    }
    try {
      const buffer = Buffer.from(encryptedBase64, 'base64')
      return safeStorage.decryptString(buffer)
    } catch {
      return null
    }
  })

  ipcMain.handle('is-encryption-available', () => {
    return safeStorage.isEncryptionAvailable()
  })

  ipcMain.handle('log-message', (_, level: string, message: string, ...args: unknown[]) => {
    if (level === 'error') {
      logger.error(message, ...args)
    } else if (level === 'warn') {
      logger.warn(message, ...args)
    } else {
      logger.info(message, ...args)
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
