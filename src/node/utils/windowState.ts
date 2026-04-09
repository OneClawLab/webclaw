import { throttle } from "@lib/utils.js";
import { path } from "@lib/path.js";
import { PATH_WINDOW_STORAGE } from "@lib/paths.js";
import fs from 'fs'

// Window state management functions
type WindowState = { bounds: Electron.Rectangle; maximized: boolean; fullscreen: boolean; }

export function loadWindowState(): WindowState {
  const fullPath = path.join(PATH_WINDOW_STORAGE(), 'default', 'ui.json');

  try {
    const json = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    return json.frame as WindowState;
  } catch {
    return { bounds: { width: 640, height: 480, x: 100, y: 100}, maximized: false, fullscreen: false }
  }
}

export function registerWindowStateHandlers(win: Electron.BrowserWindow) {   
  const throttledSendWindowState = throttle(() => {
    const state = { bounds: win.getNormalBounds(), maximized: win.isMaximized(), fullscreen: win.isFullScreen() }
    win.webContents.send('eidux:window-state-changed', state);
  }, 300);

  win.on('resize', throttledSendWindowState)
  win.on('move', throttledSendWindowState)
  win.on('maximize', throttledSendWindowState)
  win.on('unmaximize', throttledSendWindowState)
  win.on('restore', throttledSendWindowState)
  win.on('enter-full-screen', throttledSendWindowState)
  win.on('leave-full-screen', throttledSendWindowState)
  win.on('close', (event) => {
    // Prevent the window from closing immediately
    event.preventDefault();
    // Save the window state before closing
    throttledSendWindowState();
    // Close the window after saving state
    win.destroy();
  });

  // 注册时先发送一次当前状态
  throttledSendWindowState();
}
