// logger can be called in renderer process.

// @lib/logger can only be used in renderer or preload process.
// import { isDev, ELECTRON_CONTEXT, OS } from '@lib/env'
// console.info(`import @lib/logger from: dev = ${isDev()}, ELECTRON_CONTEXT = ${ELECTRON_CONTEXT}, OS = ${OS}`);

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose'

function sanitizeObject(obj: any, stack: any[] = [], maxDepth = 5): any {
  // 基本类型直接返回
  if (obj === null || obj === undefined || typeof obj === 'string' ||
      typeof obj === 'number' || typeof obj === 'boolean') {
    return obj
  }

  // 超过最大深度直接返回 '[MaxDepth]'
  if (stack.length >= maxDepth) return '...';

  // 函数类型特殊处理
  if (typeof obj === 'function') {
    return `[Function: ${obj.name || 'anonymous'}]`
  }

  // DOM 和 Window 特殊处理
  if (typeof Element !== 'undefined' && obj instanceof Element) return `[Element: ${obj.tagName}#${obj.id}]`
  if (typeof Window !== 'undefined' && obj instanceof Window) return `[Window]`

  // 循环引用检测
  if (stack.includes(obj)) return '@@@'

  // 数组递归处理
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, [...stack, obj], maxDepth))
  }

  // 对象递归处理
  const result: Record<string, any> = {}
  for (const key in obj) {
    result[key] = sanitizeObject(obj[key], [...stack, obj], maxDepth)
  }
  return result
}

function sanitizeArgs(args: unknown[], maxDepth = 5): unknown[] {
  return args.map(arg => {
    if (arg instanceof Error) {
      return {
        name: arg.name,
        message: arg.message,
        stack: arg.stack,
      }
    }

    try {
      return sanitizeObject(arg, [], maxDepth)
    } catch (e) {
      return { args: '[Unserializable]', error: e instanceof Error ? { name: e.name, message: e.message, stack: e.stack } : String(e) }
    }
  })
}

const logger = {
  // 通过 IPC 发送日志到主进程。level 是日志级别，args 是日志内容。
  // 注意：
  //  在 Electron 中，renderer 进程不能直接访问 Node.js 模块，所以需要通过 IPC 通信将日志发送到主进程处理。
  //  这里假设主进程有一个监听 'log' 事件的处理方法来接收日志消息
  //  例如：ipcMain.on('log', (event, level, ...args) => { ... })
  //  这样可以在主进程中使用 winston 或其他日志库来处理日志。
  //  这里的 sanitizeArgs 函数用于确保日志内容是可序列化的，避免在 IPC 通信中传递无法序列化的对象，如：函数、类实例等。
  logWithArgs: (level: LogLevel, message: string, ...args: unknown[]) => {
    const safeArgs = sanitizeArgs(args);
    window.eidux.log(level, message, ...safeArgs);
  },

  // 直接暴露方法，方便在其他模块中调用
  error: (message: string, ...args: unknown[]) => logger.logWithArgs('error', message, ...args),
  warn: (message: string, ...args: unknown[]) => logger.logWithArgs('warn', message, ...args),
  info: (message: string, ...args: unknown[]) => logger.logWithArgs('info', message, ...args),
  debug: (message: string, ...args: unknown[]) => logger.logWithArgs('debug', message, ...args),
  verbose: (message: string, ...args: unknown[]) => logger.logWithArgs('verbose', message, ...args),
}

export { logger as Logger }
