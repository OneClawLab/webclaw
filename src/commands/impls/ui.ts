import { Logger, Assert } from '@lib/logast.js'
import { k18, t } from '@lib/i18n.js';
import { defineCommand, defineCommandGroup, dispatchCommand } from '@commands/registry.js';
import { getAppDispatch, getState } from '@state/storeHolder.js';

// Define commands for main window control

defineCommandGroup({
  id: 'main-window',
  title: k18('commands.mainWindow.title'),
  commands: []
});

defineCommand({
  id: 'main-window/minimize',
  group: 'main-window',
  title: k18('commands.mainWindow.commands.minimize'),
  run(args) {
    window.eidux.windowControl('minimize');
  },
});

defineCommand({
  id: 'main-window/maximize',
  group: 'main-window',
  title: k18('commands.mainWindow.commands.maximize'),
  run(args) {
    window.eidux.windowControl('maximize');
  },
});

defineCommand({
  id: 'main-window/close',
  group: 'main-window',
  title: k18('commands.mainWindow.commands.close'),
  async run(args) {
    // 这里需要判断是否有未保存的文档，如果有则提示保存
    const state = getState();
    const unsavedTabs = state.tab.tabs.filter(tab => tab._dirty);
    if (unsavedTabs.length > 0) {
      const result = await dialog.confirm({
        title: t('commands.mainWindow.commands.closeConfirmTitle'),
        message: t('commands.mainWindow.commands.closeConfirmMessage', { count: unsavedTabs.length }),
        buttons: [
          { label: t('commands.mainWindow.commands.closeConfirmSaveButton'), value: 'save' },
          { label: t('commands.mainWindow.commands.closeConfirmDiscardButton'), value: 'discard' },
          { label: t('commands.mainWindow.commands.closeConfirmCancelButton'), value: 'cancel', isPrimary: true },
        ]
      });
      if (result === 'save') {
        // 保存所有未保存的标签页，等待完成，然后关闭窗口
        await Promise.all(unsavedTabs.map(tab => dispatchCommand('tab/save', { tabId: tab.id })));
        // 然后关闭窗口
        window.eidux.windowControl('close');
      } else if (result === 'discard') {
        // 直接关闭窗口
        window.eidux.windowControl('close');
      } else {
        // 取消关闭
        Logger.debug('UI Command', 'main-window/close: user cancelled close');
      }
    } else {
      // 没有未保存的标签页，直接关闭窗口
      window.eidux.windowControl('close');
    }
  },
});

//------------------------------------------------------------------
import { uiActions } from '@state/slices/ui/slice.js';
import { dialog, toast } from '@lib/renderer/dialog.js';
import { theFocusManager } from '@view/index.js';
import { Input } from 'electron/common';
import { ToastType } from '@state/slices/dialog/types.js';
import { dispatchEditorCommand } from '@editor/commands/registry.js';
import { theDocManager } from '@editor/DocManager.js';

defineCommandGroup({
  id: 'ui',
  title: k18('commands.ui.title'),
  commands: []
});

defineCommand({
  id: 'ui/command-palette/show',
  group: 'ui',
  title: k18('commands.ui.commands.showCommandPalette'),
  run(args) {
    Logger.debug('UI Slice: Showing command palette');
    dialog.showModal({
      id: 'command-palette',
      type: 'command-palette',
      props: { onClose: () => dialog.hideModal('command-palette') }
    })
  }
});

defineCommand({
  id: 'ui/about-dialog/show',
  group: 'ui',
  title: 'About',
  run(args) {
    Logger.debug('UI Slice: Showing about dialog');
    dialog.showModal({
      id: 'about-dialog',
      type: 'about-dialog',
      props: { onClose: () => dialog.hideModal('about-dialog') }
    })
  }
});

defineCommand({
  id: 'ui/nav-bar/toggle',
  group: 'ui',
  title: k18('commands.ui.commands.toggleNavBar'),
  run(args) {
    const dispatch = getAppDispatch();
    dispatch(uiActions.toggleNavBarVisible());
  }
});

defineCommand({
  id: 'ui/outline-view/toggle',
  group: 'ui',
  title: k18('commands.ui.commands.toggleOutlineView'),
  run(args) {
    const dispatch = getAppDispatch();
    dispatch(uiActions.toggleOutlineViewVisible());
  }
});

defineCommand({
  id: 'ui/tab-area/toggle',
  group: 'ui',
  title: k18('commands.ui.commands.toggleTabArea'),
  run(args) {
    const dispatch = getAppDispatch();
    dispatch(uiActions.toggleTabAreaVisible());
  }
});

defineCommand({
  id: 'ui/side-panel/toggle',
  group: 'ui',
  title: k18('commands.ui.commands.toggleSidePanel'),
  run(args) {
    const dispatch = getAppDispatch();
    dispatch(uiActions.toggleSidePanelVisible());
  }
});

defineCommand({
  id: 'ui/status-bar/toggle',
  group: 'ui',
  title: k18('commands.ui.commands.toggleStatusBar'),
  run(args) {
    const dispatch = getAppDispatch();
    dispatch(uiActions.toggleStatusBarVisible());
  }
});

//------------------------------------------------------------------

// hotkey: 处理一些渲染进程收不到的特殊按键，如 F5/F6, Mod+=, Mod+- 等等
// 需要在主进程拦截后转发到渲染进程，再由渲染进程分发命令处理。
defineCommand({
  id: 'ui/hotkey',
  group: 'ui',
  title: k18('commands.ui.commands.hotkeyTitle'),
  run(args) {
    const input = (args as { input: Input }).input;

    if (input.key === 'F5') {
      dispatchCommand('ui/refresh', {});
      return;
    }

    if (input.control || input.meta) {
      if (input.key === '=') {
        const view = theFocusManager.getCurrentFocusedView();
        if (view && view.type === 'EditorView') {
          const editorView = theDocManager.getEditorView(view.id)!;
          dispatchEditorCommand('editor/visible.level/increase', editorView, {});
        }
        return;
      }
      if (input.key === '-') {
        const view = theFocusManager.getCurrentFocusedView();
        if (view && view.type === 'EditorView') {
          const editorView = theDocManager.getEditorView(view.id)!;
          dispatchEditorCommand('editor/visible.level/decrease', editorView, {});
        }
        return;
      }
    }
  }
});

// toast: 短暂消失的信息
defineCommand({
  id: 'ui/toast',
  group: 'ui',
  title: k18('commands.ui.commands.toastTitle'),
  run(args: { msg: string, type: ToastType, title?: string, duration?: number }) {
    const { msg, type, title, duration } = args;
    toast.show(msg, type, title, duration);
  }
});

// notification: 持续存在的信息
defineCommand({
  id: 'ui/notification',
  group: 'ui',
  title: k18('commands.ui.commands.notificationTitle'),
  run(args: { msg: string, type: string, title?: string, duration?: number }) {
    // TODO not implemented yet
  }
});

// 全局 F2重命名 命令，根据当前焦点视图类型分发到具体视图的重命名命令实现
defineCommand({
  id: 'ui/rename',
  group: 'ui',
  title: k18('commands.ui.commands.renameTitle'),
  shortcut: 'F2',
  run(args) {
    const state = getState();

    const view = theFocusManager.getCurrentFocusedView();
    if (!view) {
      Logger.warn('UI Command', 'rename: no focused view');
      return;
    }

    switch (view.type) {
      case 'TreeView': {
        const treeId = view.id; // TreeView 的 ID 就是 treeId
        dispatchCommand('tree/node/rename/start', { treeId });
        return;
      }
      default:
      Logger.warn('UI Command', `rename: focused view does not support rename: ${view.id}`);
      return;
    }
  }
});

// 全局 Delete删除 命令，根据当前焦点视图类型分发到具体视图的删除命令实现
defineCommand({
  id: 'ui/delete',
  group: 'ui',
  title: k18('commands.ui.commands.deleteTitle'),
  shortcut: 'Delete',
  run(args) {
    const state = getState();

    const view = theFocusManager.getCurrentFocusedView();
    if (!view) {
      Logger.warn('UI Command', 'delete: no focused view');
      return;
    }

    switch (view.type) {
      case 'TreeView': {
        const treeId = view.id; // TreeView 的 ID 就是 treeId
        dispatchCommand('tree/node/delete', { treeId });
        return;
      }
      default:
        Logger.warn('UI Command', `delete: focused view does not support delete: ${view.id}`);
        return;
    }
  }
});

// 全局 Refresh刷新 命令，根据当前焦点视图类型分发到具体视图的删除命令实现
defineCommand({
  id: 'ui/refresh',
  group: 'ui',
  title: k18('commands.ui.commands.refreshTitle'),
  shortcut: ['F5', 'Mod+R'],
  run(args) {
    const state = getState();

    const view = theFocusManager.getCurrentFocusedView();
    if (!view) {
      Logger.warn('UI Command', 'refresh: no focused view');
      return;
    }

    switch (view.type) {
      case 'TreeView': {
        dispatchCommand('workspace/refreshLibrary', {});
        return;
      }
      case 'EditorView': {
        dispatchCommand('tab/refresh', {});
        return;
      }
      default:
        Logger.warn('UI Command', `refresh: focused view does not support refresh: ${view.id}`);
        return;
    }
  }
});
