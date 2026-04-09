// 关键运行环境信息
// 此文件在 main/renderer 进程均有用到
//
// import 此文件后就能直接用的:
//   ELECTRON_CONTEXT: 'main' | 'renderer' | 'preload' | 'other.xxx'
//   OS: 'windows' | 'macos' | 'linux' | 'unknown' | other platform strings
//
// 需要(在main.ts/main.tsx中)初始化后才能用的:
//   isDev(): boolean
//   getEnvVar(key: string): string | undefined

////////////////////////////////////////////////////////////////////////////////////
// ELECTRON CONTEXT
////////////////////////////////////////////////////////////////////////////////////

// 返回： 'main' | 'renderer' | 'preload' | 'other.xxx' (各种错误情况描述)
// 一般不应该返回 other.xxx，除非在非 Electron 环境下运行。
export const ELECTRON_CONTEXT = (() => {
  const _process = (globalThis as any)?.process || undefined;

  // 非 Node 环境
  if (typeof _process === 'undefined')
    return (typeof window === 'undefined') ? 
      'other.process-undefined.window-undefined' : 'renderer';

  // Electron 主进程
  if (_process.type === 'browser') 
    return 'main'

  // Electron 渲染/预加载
  if (_process.type === 'renderer') {
    // contextIsolation: 
    //  为 true 时，preload 脚本确实运行在独立上下文里；
    //  为 false 时，preload 与 renderer 共用上下文。
    //    此时可以这样判断 preload: 无 window 对象 或 window.process 不存在
    if (_process.contextIsolated || typeof window === 'undefined' || !window.process)
      return 'preload';
    // 否则就是 renderer
    return 'renderer';
  }

  // 其他未知 process.type
  return _process.type
    ? `other.process.type-unknown-${_process.type}`
    : 'other.process.type-undefined';
})();

export const isMain = ELECTRON_CONTEXT=== 'main';
export const isRenderer = ELECTRON_CONTEXT === 'renderer';
export const isPreload = ELECTRON_CONTEXT === 'preload';

////////////////////////////////////////////////////////////////////////////////////
// OS
////////////////////////////////////////////////////////////////////////////////////

import Bowser from 'bowser'

export const OS = (() => {
  const _process = (globalThis as any)?.process || undefined;

  let os: string | undefined = undefined;

  // if not in Node.js, suppose we're in Web Browser, then use bowser to detect OS
  if (typeof _process === 'undefined' && typeof window !== 'undefined')
    // Windows/macOS/Linux/iOS/Android
    os = Bowser.getParser(window.navigator.userAgent).getOSName().toLowerCase();

  // if in Node.js, use process.platform to detect OS
  // https://nodejs.org/api/process.html#process_process_platform
  if (typeof _process !== 'undefined') {
    switch (_process.platform) {
      case 'win32':
        os = 'windows';
        break;
      case 'darwin':
        os = 'macos';
        break;
      case 'linux':
        os = 'linux';
        break;
      default:
        os = _process.platform || 'unknown';
        break;
    }
  }

  return os || 'unknown';
})()

export const isWindows = (OS === 'windows');
export const isMac = (OS === 'macos');
export const isLinux = (OS === 'linux');

////////////////////////////////////////////////////////////////////////////////////
// isDev()
////////////////////////////////////////////////////////////////////////////////////

let _isDev: boolean | undefined = undefined;

export function isDev(): boolean {
  if (_isDev === undefined)
    throw new Error("isDev is not set yet. Make sure to call setIsDev() early in main/preload process.");

  if (isRenderer)
    return (window as any).env.isDev;  // 这是我们从 preload 注入的变量
  // 在 main 或 preload 进程里，返回之前设置注入的值
  return _isDev!;
}

// 在 main 或 preload 进程里需要尽早注入，以便后续代码可以使用
export function setIsDev(value: boolean): void {
  _isDev = value;
}

let _appVer: string | undefined = undefined;

export function getAppVer(): string {
  if (_appVer === undefined)
    throw new Error("appVer is not set yet. Make sure to call setAppVer() early in main/preload process.");
  return _appVer!;
}

// 在 main 或 preload 进程里需要尽早注入，以便后续代码可以使用
export function setAppVer(value: string): void {
  _appVer = value;
}

////////////////////////////////////////////////////////////////////////////////////
// getEnvVar()
////////////////////////////////////////////////////////////////////////////////////

const theEnvVars: Record<string, string> = {};

// 用于从外部一次性注入(追加/覆盖)多个环境变量
export function setEnvVars(vars: Record<string, string>): void {
  Object.assign(theEnvVars, vars);
}

// 获取单个环境变量的值
export function getEnvVar(key: string): string | undefined {
  return theEnvVars[key];
}
