import fs from 'fs'
import { Logger } from '@node/logger.js'
import { BrowserWindow, ipcMain } from 'electron/main'

interface WatchEntry {
  watcher: fs.FSWatcher
  debounceTimer: ReturnType<typeof setTimeout> | null
}

const watchers = new Map<string, WatchEntry>()

export function watchDirectory(dirPath: string, win: BrowserWindow): void {
  if (watchers.has(dirPath)) return

  try {
    const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
      const entry = watchers.get(dirPath)
      if (!entry) return

      // Debounce: clear existing timer and set new one
      if (entry.debounceTimer) {
        clearTimeout(entry.debounceTimer)
      }
      entry.debounceTimer = setTimeout(() => {
        entry.debounceTimer = null
        if (!win.isDestroyed()) {
          win.webContents.send('fs:change', { dirPath, filename, eventType })
        }
      }, 500)
    })

    watcher.on('error', (err) => {
      Logger.warn('fsWatcher', `Watch error for ${dirPath}:`, err)
      unwatchDirectory(dirPath)
    })

    watchers.set(dirPath, { watcher, debounceTimer: null })
    Logger.info('fsWatcher', `Watching directory: ${dirPath}`)
  } catch (err) {
    Logger.warn('fsWatcher', `Failed to watch directory ${dirPath}:`, err)
  }
}

export function unwatchDirectory(dirPath: string): void {
  const entry = watchers.get(dirPath)
  if (!entry) return

  if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
  entry.watcher.close()
  watchers.delete(dirPath)
  Logger.info('fsWatcher', `Stopped watching: ${dirPath}`)
}

export function unwatchAll(): void {
  for (const dirPath of watchers.keys()) {
    unwatchDirectory(dirPath)
  }
}

export function registerFsWatchIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle('fs:watch', (_event, dirPath: string) => {
    watchDirectory(dirPath, win)
  })

  ipcMain.handle('fs:unwatch', (_event, dirPath: string) => {
    unwatchDirectory(dirPath)
  })
}
