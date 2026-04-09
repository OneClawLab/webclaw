console.info('@@@1 Main scrpit starting...');

// 尽早注入关键全局变量，以便后续代码可以使用
import { app } from 'electron/main'
import { setIsDev } from '@lib/env.js'
import { isDev, ELECTRON_CONTEXT, OS } from '@lib/env.js'
{
  setIsDev(app.isPackaged === false);
  console.info(`@@@2 Main scrpit starting (lib/env): dev = ${isDev()}, ELECTRON_CONTEXT = ${ELECTRON_CONTEXT}, OS = ${OS}`);
}

import { init_PATHS, initEnvVars } from './init.js';
import { setEnvVars } from '@lib/env.js'
import { PATH_APP, PATH_USER, set_PATH_APP, set_PATH_USER, PATH_ASSETS } from '@lib/paths.js';
{
  // 初始化两个关键路径: path_app, path_user (包括里边的内容)
  const { path_app, path_user } = init_PATHS();
  set_PATH_APP(path_app); set_PATH_USER(path_user);

  // 解析外部 env文件，注入到 @lib/env.js 中
  const env_vars = initEnvVars(isDev(), path_app, path_user);
  if (!env_vars)
    console.warn('@@@3 Main scrpit starting (env file): No env vars loaded, AI feature unavailable.');
  else
    setEnvVars(env_vars);
}

/////////////////////////////////////////
// 从这里开始启用我们的日志记录器
import { initLogger, Logger } from "@node/logger.js"
initLogger();
Logger.info(`@@@ Main scrpit starting: dev = ${isDev()}, ELECTRON_CONTEXT = ${ELECTRON_CONTEXT}, OS = ${OS}, AppPath = ${PATH_APP()}, UserPath = ${PATH_USER()}`);

import { BrowserWindow, Menu, globalShortcut, MenuItemConstructorOptions } from 'electron/main'
import { Input, shell } from 'electron/common'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { installExtension, REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } from 'electron-devtools-installer'

import { join } from 'path'
import { homedir } from 'os'
import { isForceQuit, registerAllIpcHandlers, registerWindowControlIpcHandlers } from './ipc.js';
import { registerFsWatchIpcHandlers, unwatchAll } from './utils/fsWatcher.js';
import { loadWindowState, registerWindowStateHandlers } from './utils/windowState.js';
import { handleConsoleMessage } from './utils/handleConsoleMessage.js';
import { XgwClient } from './xgw/client.js';
import type { XgwClientConfig } from './xgw/client.js';
import { registerXgwIpcHandlers } from './xgw/bridge.js';
import { StorageImpl } from './bridge/bridges.impls.js';

// import './test'

// 在 app ready 前 设置的一个启动 chromium 的 command line switch 示例
// app.commandLine.appendSwitch('disable-gpu');
// app.commandLine.appendSwitch('enable-logging');

if (process.env.EIDUX_MODE === "release") {
  app.commandLine.appendSwitch("disable-dev-tools");
} else {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');       // 设置 renderer 调试端口
  app.commandLine.appendSwitch('disable-background-timer-throttling'); // 可选，避免延迟
}

// main process 向 renderer 进程发送应用级事件
// event: 事件名称
// args: 事件参数对象，永远是一个参数 {...} 
export function emitAppEvent(win: BrowserWindow, event: string, args: any = {}): void {
  // if (event !== 'window-focus')
  //   console.debug(`emitAppEvent: event=${event}, args=`, args);
  win.webContents.send('eidux:event', { event, args });
}

// Define a function to create the main window
function createWindow(): void {
  Logger.info('main','new BrowserWindow');

  /// Register all IPC handlers
  registerAllIpcHandlers(); 
  
  // Initialize XgwClient and register IPC bridge
  const defaultXgwConfig: XgwClientConfig = {
    host: '127.0.0.1',
    port: 28211,
    channelId: 'webui:default',
    peerId: 'owner',
  }
  const storage = new StorageImpl()
  const savedXgwConfig = storage.exists('xgw-connection') ? storage.load('xgw-connection') as XgwClientConfig | null | undefined : undefined;
  const xgwConfig: XgwClientConfig = savedXgwConfig ?? defaultXgwConfig
  const xgwClient = new XgwClient(xgwConfig)

  // 加载 'default' 工作区 的窗口状态文件路径
  const savedWindowState = loadWindowState();

  const appIconPath = join(PATH_ASSETS(), 'icon.png')

  // 要通过命令行传给 preload 进程的数据
  const userData = {
    isDev: isDev(),
    OS: OS,
    appVer: app.getVersion(),
    appPath: PATH_APP(),
    userPath: PATH_USER(),
    homeDir: homedir(),
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      v8: process.versions.v8,
    },
  }
  // JSON序列化后再转成 Base64 传递
  const userDataStr = Buffer.from(JSON.stringify(userData)).toString('base64');

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    title: 'WebClaw',

    minWidth: 600,
    minHeight: 400,
    ...savedWindowState.bounds, // 使用上次保存的窗口尺寸和位置
    show: false,

    autoHideMenuBar: OS === 'windows' ? false : true, // Windows 平台下自动隐藏菜单栏，按 Alt 键显示。macOS 和 Linux 保持默认行为。
    frame: OS === 'windows' ? false : true,           // macOS 和 Linux 使用原生标题栏，Windows 使用自定义标题栏
    thickFrame: OS === 'windows' ? true : false,      // 显示厚边框风格（Windows 和 Linux）

    ...(process.platform === 'linux' ? { icon: appIconPath } : {}),

    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      // 注: 以下三个参数组合下，preload/renderer将是同一进程不同上下文(应该指chrome的不同workder）。
      // preload代码里没有window，不能直接共享全局变量给renderer进程。
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,

      defaultFontFamily: {
        standard: 'Arial, sans-serif',
        serif: 'Times New Roman, serif',
        monospace: 'Courier New, monospace'
      },
      defaultFontSize: 14,
      defaultMonospaceFontSize: 12,
      minimumFontSize: 8,

      devTools: process.env.EIDUX_MODE === "release" ? false : true,
      plugins: false,        // disable plugins like Flash

      enableDeprecatedPaste: false,    // disable deprecated pasteboard API
      enableWebSQL: false,             // disable obsoleted websql support
      imageAnimationPolicy: 'animate', // just as default
      spellcheck: false,               // disable built-in spellchecker
      zoomFactor: 1.0,                 // default zoom factor

      // 通过命令行参数传递 userData 给 preload进程
      additionalArguments: [`--userData=${userDataStr}`]
    }
  });
  
  if (savedWindowState.maximized) mainWindow.maximize();
  if (savedWindowState.fullscreen) mainWindow.setFullScreen(true);

  registerWindowStateHandlers(mainWindow);
  registerWindowControlIpcHandlers(mainWindow);

  // Register xgw IPC handlers now that we have the window reference
  registerXgwIpcHandlers(xgwClient, mainWindow);

  // Register fs watch IPC handlers
  registerFsWatchIpcHandlers(mainWindow);

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (isDev() && process.env['ELECTRON_RENDERER_URL']) {
    const url = process.env['ELECTRON_RENDERER_URL'];

    // 异步启动，不阻塞 main
    (async () => {
      try {
        Logger.info(`Loading renderer from remote URL ${url}`);
        await mainWindow.loadURL(url);
        Logger.info(`Loadded renderer from remote URL ${url}`);
      } catch (e) {
        Logger.error('loadURL failed', e);
      }
    })();

  } else {
    const file = app.isPackaged ? 
      path.join(process.resourcesPath, "app.asar/out/renderer/index.html") : 
      join(__dirname, '../../renderer/index.html');
    Logger.info(`Loading renderer from local file ${file}`);
    mainWindow.loadFile(file);
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    Logger.error(`did-fail-load: ${errorCode}, ${errorDescription}, url=${validatedURL}`);
  });
  mainWindow.webContents.on('did-start-loading', () => {
    Logger.info(`did-start-loading`);
    mainWindow.show();
  });
  mainWindow.webContents.on('did-stop-loading', () => {
    Logger.info(`did-stop-loading`);
  });
  mainWindow.webContents.on('did-frame-finish-load', (_, isMainFrame) => {
    Logger.info(`did-frame-finish-load isMain=${isMainFrame}`);
  });

  // show main window 的三个时机，最早/适中/最晚
  // mainWindow.on('ready-to-show', () => {
  mainWindow.webContents.once('dom-ready', () => {
  //mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.show();
    xgwClient.connect();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    Logger.info('Opening external URL:', details.url);
    shell.openExternal(details.url)
    return { action: 'deny' }
  });

  mainWindow.webContents.on('console-message', (event) => {
    handleConsoleMessage(event as Electron.WebContentsConsoleMessageEventParams);
  });

  mainWindow.on('close', (event) => {
    Logger.info('Main window closing');
    if (mainWindow.isDestroyed()) {
      Logger.info('Main window already destroyed, skipping close handling');
      return;
    }
    if (isForceQuit()) {
      Logger.info('Force quit, skipping close handling');
      unwatchAll();
      return;
    } else {
      // 阻止默认行为，改为发送事件给渲染进程处理
      // 当渲染进程处理完后，会再次通过 eidux:window-control 的 close 操作来真正关闭窗口(此时 isForceQuit 已经被设置为 true)
      event.preventDefault();
      mainWindow.webContents.send('eidux:window-closing');
    }
  });

  app.on('browser-window-focus', () => {
    emitAppEvent(mainWindow, 'window-focus', { focused: true });
  });
  app.on('browser-window-blur', () => {
    emitAppEvent(mainWindow, 'window-focus', { focused: false });
  });

  {
    const keysInterested = ['F5', 'F6'];

    // 拦截一些 特殊的快捷键，那些渲染进程自身收不到的，我们在主进程捕获后转发给渲染进程。
    // 可惜 F5/F6 依然收不到。。。只好用 globalShortcut 注册全局快捷键的方式来处理了。
    // 另：在一些外接键盘，Fn + F5/F6 才能被正确识别为 F5/F6。
    mainWindow.webContents.on('before-input-event', (event, input) => {
      //Logger.debug('Main Process', `before-input-event: type=${input.type}, key=${input.key}, code=${input.code}, ctrl=${input.control}, meta=${input.meta}, alt=${input.alt}`);
      let intercept = false;
      // Mod+=, Mod+-
      if ((OS === 'windows' || OS === 'linux') && input.control || 
          (OS === 'macos' && input.meta)) {
        if (input.key === '=' || input.key === '-') {
          intercept = true;
        }
      }
      if (keysInterested.includes(input.code)) {
        intercept = true;
      }

      if (intercept) {
        event.preventDefault();
        mainWindow.webContents.send('eidux:hotkey', { input });
      }
    });

    // 主窗口焦点时注册全局快捷键
    app.on('browser-window-focus', () => {
      keysInterested.forEach(key => {
        if (!globalShortcut.isRegistered(key)) {
          globalShortcut.register(key, () => {
            //Logger.debug('Main Process', `Global shortcut triggered: ${key}`);
            const input: Input = {
              key, code: key, type: 'keyDown', control: false, meta: false, alt: false, shift: false,
              isAutoRepeat: false, isComposing: false, location: 0, modifiers: [] };
            mainWindow.webContents.send('eidux:hotkey', { input });
          });
        }
      });
    });

    // 主窗口失焦时注销全局快捷键
    app.on('browser-window-blur', () => {
      keysInterested.forEach(key => {
        if (globalShortcut.isRegistered(key)) {
          globalShortcut.unregister(key);
        }
      });
    });    
  }
}

import { path } from '@lib/path.js';
import { buildMacAppMenu, setMacAboutDialog } from './macos.js';
import { initAutoUpdater } from './autoupdate.js';

// This method will be called when Electron has finished initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.webclaw.app')

  if (OS === 'windows' || OS === 'linux') {
    // 尽管 frame: false 会隐藏原生标题栏，但仍然需要设置空的应用菜单，否则某些系统会自动添加默认菜单。
    // 默认菜单会带有一些快捷键(如 Ctrl+W/Ctrl+F4 关闭窗口)，会干扰应用的快捷键处理。
    // 我们这里添加一个 空菜单(而不是 null)，虽然两者都能阻止 Ctrl+W/Ctrl+F4 工作,
    // 但 null 会导致 before-input-event 事件无法触发，进而使我们无法拦截系统热键。
    Menu.setApplicationMenu(Menu.buildFromTemplate([]));
  // MacOS 下使用标准原生菜单
  } else if (OS === 'macos') {
    setMacAboutDialog();

    const menu = buildMacAppMenu((appCommandId: string) => {
      Logger.debug(`App Menu Item Clicked: ${appCommandId}`);
      const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      emitAppEvent(mainWindow, 'dispatchAppCommand', { appCommandId });
    });
    menu.items.forEach(item => {
      Logger.debug(`Menu Item: ${item.label}`);
      item.submenu?.items.forEach(subitem => { Logger.debug(`  SubItem: ${subitem.label}, accelerator=${subitem.accelerator}`); });
    });
    Menu.setApplicationMenu(menu);
  }

  // Install devtools extensions in development mode
  if (process.env.EIDUX_MODE === "dev") {
    try {
      const exts = await installExtension([REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS])
      Logger.info(`DevTools extension installed: ${exts.map(ext => ext.name).join(',')}`);
    } catch (err) {
      Logger.error('Failed to install DevTools extentions:', err);
    }
  }

  // Default open or close DevTools by F12 in development and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  })

  // 创建主窗口
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // 初始化自动更新器: 只自动下载，但不自动安装更新
  // 延迟几秒启动，避免检测到更新时，主窗口还没准备好处理 updateReady 事件
  setTimeout(() => {
    initAutoUpdater(false);
  }, 5000);
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // On Windows and Linux, quit the app when all windows are closed
    Logger.info('All windows closed, quitting app');
    app.quit()
  }
})

Logger.info('@@@ Main script loaded successfully');
