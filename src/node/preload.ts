// preload 的主要目的: 安全地、可控地将 Node 能力暴露给渲染进程。
// 它是 Node 与 Web 世界之间的桥梁。
// 具体能力就是利用 contextBridge + ipcRenderer 的组合，将明确授权的底层功能注入给 renderer。
// preload 运行在沙箱中，和main是两个独立的 node.js环境，更像是Renderer里开的一个后门。

// preload里写日志还是全用 console 吧，不要调用我们的 logger。
// 因为目前的配置下，preload和renderer同进程不同上下文。
// 因此不能直接调 node/logger (因为是不同进程)，也不能调 @lig/logger(因为和renderer上下文不同，没有window对象可用)。

console.info('@@@1 Preload scrpit starting...');

import { setIsDev } from '@lib/env.js'
import { set_PATH_APP, set_PATH_USER } from '@lib/paths.js';
let userData;
{
  // 解析 main 进程传递过来的 userData 参数
  const userDataStr = process.argv.find(a => a.startsWith('--userData='))
  const userDataJsonStr = userDataStr ? Buffer.from(userDataStr.slice('--userData='.length), 'base64').toString() : '{}'
  userData = JSON.parse(userDataJsonStr);
  console.info(`@@@2 Preload scrpit userData: ${userDataJsonStr}`);

  // 尽早注入关键全局变量，以便后续代码可以使用
  // 不过这个只能是 preload模块自己用，因此用处也不大
  setIsDev(userData.isDev);
  set_PATH_APP(userData.appPath);
  set_PATH_USER(userData.userPath);
}

//////////////////////////////////////////////////////////////////////////
import { isDev, ELECTRON_CONTEXT, OS } from '@lib/env.js'
import { PATH_APP, PATH_USER } from '@lib/paths.js';
console.info(`@@@3 Preload scrpit starting: dev = ${isDev()}, ELECTRON_CONTEXT = ${ELECTRON_CONTEXT}, OS = ${OS}, appPath = ${PATH_APP()}, userPath = ${PATH_USER()}`);

import { contextBridge, ipcRenderer } from 'electron/renderer'
import { electronAPI } from '@electron-toolkit/preload'
import { Input } from 'electron/common'

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose'
type WindowState = { bounds: Electron.Rectangle; maximized: boolean; fullscreen: boolean; }

const eiduxAPI = {
  log: (level: LogLevel, message: string, ...args: unknown[]) => {
    ipcRenderer.send('eidux:log', level, message, ...args)
  },
  windowControl: (action: 'minimize' | 'maximize' | 'close') => {
    ipcRenderer.send('eidux:window-control', action)
  },

  onWindowClosing: (callback: () => void) => {
    ipcRenderer.on('eidux:window-closing', () => callback())
  },
  onWindowStateChanged: (callback: (state: WindowState) => void) => {
    ipcRenderer.on('eidux:window-state-changed', (_e, state) => callback(state))
  },
  onHotkey: (callback: (input: Input) => void) => {
    ipcRenderer.on('eidux:hotkey', (_e, args) => callback(args.input));
  },
  onAppEvent: (callback: (event: string, args: any) => void) => {
    ipcRenderer.on('eidux:event', (_e, data) => {
      const { event, args } = data
      callback(event, args)
    });
  },

  exists: (name: string, namespaces?: string[]) => {
    return ipcRenderer.sendSync('eidux:exists', name, namespaces);
  },
  load: (name: string, namespaces?: string[]) => {
    return ipcRenderer.sendSync('eidux:load', name, namespaces);
  },
  save: (name: string, content: any, namespaces?: string[]) => {
    return ipcRenderer.sendSync('eidux:save', name, content, namespaces);
  }
}

import { getBridgeIntfs } from '@node/bridge/bridges.types.js';
import type { XgwClientConfig } from '@node/xgw/client.js'
import type { ServerFrame } from '@lib/webui-protocol/index.js'

const xgwAPI = {
  sendMessage: (conversationId: string, text: string) =>
    ipcRenderer.invoke('xgw:sendMessage', conversationId, text),
  openConversation: (conversationId: string, agentId: string) =>
    ipcRenderer.invoke('xgw:openConversation', conversationId, agentId),
  closeConversation: (conversationId: string) =>
    ipcRenderer.invoke('xgw:closeConversation', conversationId),
  getStatus: () =>
    ipcRenderer.invoke('xgw:getStatus'),
  updateConfig: (config: XgwClientConfig) =>
    ipcRenderer.invoke('xgw:updateConfig', config),
  onFrame: (callback: (frame: ServerFrame) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, frame: ServerFrame) => callback(frame)
    ipcRenderer.on('xgw:frame', listener)
    return () => ipcRenderer.removeListener('xgw:frame', listener)
  },
  onStatusChange: (callback: (status: string) => void) => {
    ipcRenderer.on('xgw:status', (_e, status) => callback(status))
  },
  onAgentsUpdate: (callback: (agents: string[]) => void) => {
    ipcRenderer.on('xgw:agents', (_e, agents) => callback(agents))
  },
  onError: (callback: (msg: string) => void) => {
    ipcRenderer.on('xgw:error', (_e, msg) => callback(msg))
  },
}

const fsWatchAPI = {
  watch: (dirPath: string) => ipcRenderer.invoke('fs:watch', dirPath),
  unwatch: (dirPath: string) => ipcRenderer.invoke('fs:unwatch', dirPath),
  onChange: (callback: (data: { dirPath: string; filename: string | null; eventType: string }) => void) => {
    ipcRenderer.on('fs:change', (_e, data) => callback(data))
  },
}

function exposeAllBridgesToRenderer() {
  const intfs = getBridgeIntfs();
  for (const [namespace, instance] of Object.entries(intfs)) {
    const exposed: Record<string, (...args: any[]) => Promise<any>> = {};

    const prototype = Object.getPrototypeOf(instance);
    Object.getOwnPropertyNames(prototype).forEach((method) => {
      if (method === 'constructor') return;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
      if (!descriptor) return;
      if (typeof descriptor.value !== 'function') return;

      exposed[method] = (...args: any[]) => ipcRenderer.invoke(`${namespace}:${method}`, ...args);
    });

    contextBridge.exposeInMainWorld(namespace, exposed);
    // console.info(`@@@7 Preload scrpit: window.${namespace} exposed`);
  }
}

try {
  // 把 main 进程传递过来的 userData，继续通过IPC机制传递给 renderer进程。
  const env = {
    context: 'renderer', // 这是给 renderer用的，因此设置为 renderer
    isDev: userData.isDev,
    OS: userData.OS,
    appVer: userData.appVer,
    appPath: userData.appPath,
    userPath: userData.userPath,
    homeDir: userData.homeDir,
    versions: userData.versions,
  };
  contextBridge.exposeInMainWorld('env', env);
  //console.info(`@@@4 Preload scrpit: window.env exposed`);

  contextBridge.exposeInMainWorld('electron', electronAPI);
  //console.info(`@@@5 Preload scrpit: window.electron exposed`);

  contextBridge.exposeInMainWorld('eidux', eiduxAPI); 
  //console.info(`@@@6 Preload scrpit: window.eidux exposed`);

  // 暴露 xgw API
  contextBridge.exposeInMainWorld('xgw', xgwAPI)

  // 暴露 fsWatch API
  contextBridge.exposeInMainWorld('fsWatch', fsWatchAPI)

  // 暴露其他使用 bridge 机制实现的模块
  exposeAllBridgesToRenderer();

} catch (error) {
  console.error('@@@7 Preload scrpit: expose APIs failed', error);
}

type ConsoleMethod = (...args: any[]) => void;

// 安装 console 过滤器，避免在 DevTools 中看到无用错误信息
function setupConsoleFilter() {
  const methods = ['error','warn', 'log'] as const;
  const ignorePatterns = [
    /Autofill\.(enable|setAddresses)/,
    /sandboxed_renderer\.bundle\.js/,
    /electron\/js2c/,
    /object null is not iterable/,
    /wasn't found/,
  ];

  methods.forEach((methodName) => {
    const originalMethod = console[methodName] as ConsoleMethod;
    console[methodName] = (...args: any[]) => {
      const msg = args.map(String).join(' ');
      if (ignorePatterns.some((pattern) => typeof pattern === 'string' ? msg.includes(pattern) : pattern.test(msg))) return;
      originalMethod.apply(console, args);
    };
  });
}

if (isDev()) {
  setupConsoleFilter();
  console.info(`@@@8 Preload scrpit: console filter installed`);
}

console.info('@@@9 Preload script loaded successfully');
