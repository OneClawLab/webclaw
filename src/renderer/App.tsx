import { Logger, Assert } from '@lib/logast.js'
import React, { useEffect } from 'react'
import { useAppDispatch, useAppSelector, useEffectOnce } from '@state/storeHolder.js'

import { useHotkeyManager } from '@hotkeys/useHotkeyManager.js'
import { dispatchAppCommand, getAllCommands as getAllAppCommands } from '@commands/registry.js'
import { useLanguageSync } from '@lib/renderer/useLanguageSync.js'

// 引入所有命令以确保它们被注册
import '@commands/impls/index'
import '@editor/commands/impls/index'

import { AppLayout } from './layout/AppLayout.js'
import { DialogSystem } from './components/DialogSystem.js'
import { AppMenu } from './components/AppMenu.js'
import { StatusBarEx } from './components/StatusBar.js'
import { uiActions } from '@state/slices/ui/slice.js'
import { FrameState } from '@state/slices/ui/types.js'
import { AppEvents, emitAppEvent, theAppEventBus } from '@event/app.js'
import { theFocusManager } from '@view/index.js'
import { OS } from '@lib/env.js'

export function App(): React.JSX.Element {
  Logger.debug('App', 'Rendering App component');
  const dispatch = useAppDispatch();
  const hotkeyManager = useHotkeyManager()

  // 同步语言设置与i18n
  useLanguageSync();

  useEffect(() => {
    // 监听主进程发来的 Event 事件，转接到我们的 事件总线
    window.eidux.onAppEvent((type, args) => {
      if (type !== 'window-focus')
        Logger.debug('App', `Received app event from main process: ${type}`);
      emitAppEvent(type as keyof AppEvents, args as any);
    });

    // 监听主进程发送的 热键事件，转发给 统一的 ui/hotkey 命令去分发处理
    window.eidux.onHotkey((input) => {
      // Logger.debug('App', `Received hotkey input from main process: ${code}`);
      dispatchAppCommand('ui/hotkey', { input });
    });

    window.eidux.onWindowClosing(() => {
      Logger.debug('App', 'Received window closing event from main process');
      dispatchAppCommand('ui/windowClosing', {});
    });

    // 监听主进程发送的 窗口状态变化事件，更新到 Redux 状态里
    window.eidux.onWindowStateChanged((state) => {
      // Logger.debug('App', `Received window state changed from main process: ${JSON.stringify(state)}`);
      dispatch(uiActions.updateFrameState({ state } as { state: FrameState }));
    });

    // 注册所有 AppCommand 相关的热键到 HotkeyManager
    getAllAppCommands().filter(cmd => cmd.shortcut).forEach(cmd => {
      hotkeyManager.register({ id: cmd.id, keys: cmd.shortcut!, capture: cmd.capture, description: cmd.title, callback: cmd.run });
    });

    // 注: 不要注册 EditorCommand 的热键到 HotkeyManager，应在CM6的keymap中注册

    // 监听主进程发送的 AppCommand，调用命令分发器去处理
    const offDAC = theAppEventBus.on('dispatchAppCommand', ({ appCommandId, args }) => {
      Logger.debug('App', `Dispatching app command from event bus: ${appCommandId}, args=${JSON.stringify(args)}`);
      dispatchAppCommand(appCommandId, args);
    });

    // 当 MainWindow 被Focus时，把具体Focus设置到更具体的内部组件上
    const offWF = theAppEventBus.on('window-focus', () => {
      theFocusManager.restoreFocus();
    });

    return () => { offDAC(); offWF(); }
  }, [dispatch, hotkeyManager]);

  const layout = useAppSelector(state => state.ui.layout);
  const isStatusBarVisible = layout.isStatusBarVisible;

  useEffectOnce(() => {
    Logger.debug('App', 'Component mounted');
    return () => Logger.debug('App', 'Component unmounted');
  });

  return (
    // flex竖向布局(flex flex-col)，宽度/高度 和实际窗口保持一致
    <div id="App" className="flex flex-col w-full h-screen">
      {(OS === 'windows') && (<AppMenu />)}
      <AppLayout />
      {isStatusBarVisible && (<StatusBarEx/>)}
      {/* 按需显示的弹出式组件们，一般都是绝对定位的 */}
      <DialogSystem />
    </div>
  )
}
