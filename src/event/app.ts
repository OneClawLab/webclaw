import { useEffect, useRef } from 'react'
import { EventBus } from './bus.js'

// AppEvent 类型定义
export interface AppEvents {
  /// App Level

  // 主窗口获得或失去焦点，由main进程拦截后转发到renderer进程
  'window-focus': { focused: boolean }
  // AppCommand事件, 由main进程(主要是MacOS上)菜单命令触发，转发到renderer进程
  'dispatchAppCommand': { appCommandId: string, args?: any }

  /// TreeView

  'tree:refreshed': void
  'tree:rendered': void

  /// EditorView

  'editor:created': { docId: string, tabId: string }
  'editor:destroyed': { docId: string, tabId: string }

  /// xgw frame events (emitted by FrameRouter)
  'xgw:compact_start': { reason: string }
  'xgw:compact_end': { before_tokens: number; after_tokens: number }

  /// 对话框

  // 'dialog:opened': { id: string }
  // 'dialog:closed': { id: string }
}

// 全局 AppEvent 的事件总线
export const theAppEventBus = new EventBus<AppEvents>()

// React 组件内使用，订阅 全局 AppEvents 事件的 Hook
// 目前还没人使用
export function useAppEventBus<K extends keyof AppEvents>(
  event: K,
  handler: (payload: AppEvents[K]) => void | Promise<void>,
  deps: any[] = []
) {
  const handlerRef = useRef(handler)
  //eslint-disable-next-line react-hooks/refs
  handlerRef.current = handler

  useEffect(() => {
    const unsubscribe = theAppEventBus.on(event, (payload: AppEvents[K]) => handler(payload));
    return () => unsubscribe(); // 清理监听器
  }, [event, handler, deps])
}

// 任意地方(限renderer进程)使用，发射事件 到 全局 AppEvents 事件总线
export function emitAppEvent<K extends keyof AppEvents>(
  event: K,
  payload?: AppEvents[K] extends void ? void : AppEvents[K]
) {
  theAppEventBus.emit(event, payload as any);
}
