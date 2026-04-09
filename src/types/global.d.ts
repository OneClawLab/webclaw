// tell TypeScript complier to import `vite/client` types.
// to make import.meta.env 相关的类型和变量。
/// <reference types="vite/client" />

//--------------------------------------------------------------
import type { BridgeModules } from '@node/bridge/core'

declare type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose'
declare type WindowState = { bounds: Electron.Rectangle; maximized: boolean; fullscreen: boolean; }

// Let renderer codes can access types (injected to broswer `window` object) exposed by Electron preload script.
declare global {
  interface Window {
    // 通过 window.uilog 可以直接输出日志到Eidux App里的调试窗口
    uilog: (text: string) => void;

    env: {
      context: string
      isDev: boolean
      OS: string
      appVer: string
      appPath: string
      userPath: string
      homeDir: string
      versions: { electron: string; chrome: string; node: string; v8: string }
    }

    // 以下为 preload 脚本通过 contextBridge 暴露给渲染进程的 API，都是同步函数

    eidux: {
      log(level: LogLevel, message: string, ...args: unknown[]): void,

      windowControl(action: 'minimize' | 'maximize' | 'close'): void,
      onWindowStateChanged(callback: (state: WindowState) => void): void,
      onWindowClosing(callback: () => void): void,

      onHotkey(callback: (input: Input) => void): void,
      onAppEvent(callback: (type: string, args: any) => void): void,

      // 保存和加载 json对象，同步函数，主要用于Redux持久化
      exists(name: string, namespaces?: string[]): boolean
      load(name: string, namespaces?: string[]): any | undefined
      save(name: string, content: any, namespaces?: string[]): boolean
    },

    // 以下为使用 bridge 机制 的模块, 最后暴露出的都是异步函数
    // bridge 机制是我们基于ipc封装的一套模块化调用系统，详见 @node/bridge 相关代码。

    fs: {
      readText(path: string): Promise<string>,
      writeText(path: string, content: string): Promise<boolean>,
      exists(path: string): Promise<boolean>,
      stat(path: string): Promise<FsStats>,
      getFileSignature(filePath: string): Promise<string>,
      getDirSignature(dirPath: string): Promise<string>,
      listDir(dirPath: string): Promise<DirItem[]>,
      delete(path: string, recursive: boolean): Promise<boolean>,
      rename(oldPath: string, newPath: string): Promise<boolean>,
      ensureDir(dirPath: string): Promise<boolean>,
      ensureFile(filePath: string): Promise<boolean>
    },

    storage: { // window.eidux里 storage相关方法的异步版本
      exists(name: string, namespaces?: string[]): Promise<boolean>,
      load(name: string, namespaces?: string[]): Promise<any | undefined>,
      save(name: string, content: any, namespaces?: string[]): Promise<boolean>
    },

    ui: {
      openFile(options?: {
        title?: string
        defaultPath?: string
        filters?: Electron.FileFilter[]
        allowMultiple?: boolean
      }): Promise<string[] | null>,

      saveFile(options?: {
        title?: string
        defaultPath?: string
        filters?: Electron.FileFilter[]
      }): Promise<string | null>,

      openDirectory(options?: {
        title?: string
        defaultPath?: string
        allowMultiple?: boolean
      }): Promise<string[] | null>,

      selectDirectoryToSave(options?: {
        title?: string
        defaultPath?: string
      }): Promise<string | null>,

      showInExplorer(fullPath: string): Promise<void>,

      openExternal(url: string): Promise<void>,
      quitAndInstallUpdate(): Promise<void>
    }

    xgw: {
      sendMessage(conversationId: string, text: string): Promise<void>
      openConversation(conversationId: string, agentId: string): Promise<void>
      closeConversation(conversationId: string): Promise<void>
      getStatus(): Promise<string>
      updateConfig(config: { host: string; port: number; channelId: string; peerId: string }): Promise<void>
      onFrame(callback: (frame: import('@lib/webui-protocol/index.js').ServerFrame) => void): () => void
      onStatusChange(callback: (status: string) => void): void
      onAgentsUpdate(callback: (agents: string[]) => void): void
      onError(callback: (msg: string) => void): void
    }

    fsWatch: {
      watch(dirPath: string): Promise<void>
      unwatch(dirPath: string): Promise<void>
      onChange(callback: (data: { dirPath: string; filename: string | null; eventType: string }) => void): void
    }
  }
}
