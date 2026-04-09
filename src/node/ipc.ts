import { Logger } from "@node/logger.js"
import { BrowserWindow, ipcMain } from 'electron/main'

//////////////////////////////////////////////////////////////////////////
let _forceQuit = false;
export function isForceQuit() {
  return _forceQuit;
}

export function registerWindowControlIpcHandlers(win: BrowserWindow) {
  // NOTE 需要访问 event.sender，还不知道咋传过来，所以暂时没法用bridge机制
  ipcMain.on('eidux:window-control', (event, action) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (action === 'minimize') win.minimize()
    else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize()
    else if (action === 'close') {
      // 标记为强制退出，避免触发 close 事件里的取消操作
      _forceQuit = true;
      win.close();
    }
  })
}

//////////////////////////////////////////////////////////////////////////

import { StorageImpl } from '@node/bridge/bridges.impls.js'
let storageImpl: StorageImpl | null = null;

function registerStorageIpcHandlers() {
  // 这三个方法的实现 转接到 window.storage 模块的实现，以保持一致
  // WHY：bridge机制只能是异步的，这里用同步的 IPC 方式实现同步调用
  ipcMain.on('eidux:exists', (event, name: string, namespaces?: string[]) => {
    if (!storageImpl) storageImpl = new StorageImpl();
    event.returnValue = storageImpl.exists(name, namespaces);
  })

  ipcMain.on('eidux:load', (event, name: string, namespaces?: string[]) => {
    if (!storageImpl) storageImpl = new StorageImpl();
    event.returnValue = storageImpl.load(name, namespaces);
  })

  ipcMain.on('eidux:save', (event, name: string, content: any, namespaces?: string[]) => {
    if (!storageImpl) storageImpl = new StorageImpl();
    event.returnValue = storageImpl.save(name, content, namespaces);
  })
}

// Register all other IPC handlers
import { getBridgeImpls } from '@node/bridge/bridges.impls.js'

// 针对每一个注册 bridge模块里的每一个方法，自动实现一个对应的ipcMain.handle方法
function registerBridgeIpcHandlers() {
  const impls = getBridgeImpls();
  for (const [namespace, instance] of Object.entries(impls)) {
    const prototype = Object.getPrototypeOf(instance);
    for (const method of Object.getOwnPropertyNames(prototype)) {
      const func = instance[method];
      if (typeof func !== 'function' || method === 'constructor')
        continue;
      ipcMain.handle(`${namespace}:${method}`, async (_, ...args) => { return await func(...args) });
    }
  }
}

//////////////////////////////////////////////////////////////////////////

export function registerAllIpcHandlers() {
  //////////////////////////////////////////////////////////////////////////
  type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose'

  ipcMain.on('eidux:log', (_event, level: LogLevel, message: string, ...args) => {
    Logger[level as keyof typeof Logger](message, ...args)
  })

  registerStorageIpcHandlers();
  registerBridgeIpcHandlers();
}
