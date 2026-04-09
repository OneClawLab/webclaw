import { Logger, Assert } from '@lib/logast.js'
import { k18, t } from '@lib/i18n.js';
import { OS } from '@lib/env.js';
import { nanoid } from 'nanoid';

import { defineCommand, defineCommandGroup, dispatchCommand } from '@commands/registry.js';
import { getAppDispatch, getState } from '@state/storeHolder.js';

import { TreeUtils } from '@state/slices/tree/utils.js';
import { DocUtils } from '@state/slices/doc/utils.js';
import { UnsavedDoc } from '@state/slices/doc/types.js';
import { TabUtils } from '@state/slices/tab/utils.js';
import { TabStatus } from '@state/slices/tab/types.js';
import { tabActions } from '@state/slices/tab/slice.js';
import { docActions } from '@state/slices/doc/slice.js';
import { dialog } from '@lib/renderer/dialog.js';
import { theAppEventBus } from '@event/app.js';
import { theDocManager } from '@editor/DocManager.js';
import { DocAppender } from '@editor/DocAppender.js';

defineCommandGroup({
  id: 'tab',
  title: k18('commands.tab.title'),
  commands: []
});

// Define commands for tab operations

// 新建一个 UnsavedDocument 文档，并在新标签页中打开它
// 参见 workspace/slices/workspace/types.ts 中 UnsavedDocument 的定义
defineCommand<{ title?: string, switchTo?: boolean, switchFocus?: boolean, ignoreDirty?: boolean }>({
  id: 'tab/new',
  group: 'tab',
  title: k18('commands.tab.commands.newTab'),
  shortcut: 'Mod+N',
  async run(args) {
    const state = getState();
    const dispatch = getAppDispatch();

    // 获得一个(和其他unsaved文档不重名的)文件名
    const title = args.title || t('defaults.untitledMd');
    const siblings = DocUtils.getUnsavedDocs().map(doc => doc.tmpId);
    const fileName = TreeUtils.getUniqueName(siblings, false, title);

    // 构造一个 UnsavedDoc 对象
    const unsavedDoc: UnsavedDoc = {
      origin: 'unsaved',
      title: fileName,
      tmpId: fileName,
      conversationId: nanoid(),
      agentId: 'admin',
    };

    // 先将 doc 加入 state 中
    const docId = DocUtils.docId(unsavedDoc);
    dispatch(docActions.addDoc({ doc: unsavedDoc }));

    // 再通过命令打开对应的 Tab
    const id = TabUtils.uniqueTabId();
    const ignoreDirty = args.ignoreDirty ?? false;    
    const tab = TabUtils.createTab({ id, title: fileName, docId, ignoreDirty });
    const switchTo = args.switchTo ?? true;
    const switchFocus = args.switchFocus ?? true;
    dispatch(tabActions.openTab({ tab, switchTo, switchFocus }));

    return tab;
  }
});

// docId: 要打开的全局文档ID (DocUtils.docId(doc))
// 注: 支持 Library目录文档 打开
defineCommand<{ docId: string, switchTo: boolean, switchFocus: boolean, forceNewTab?: boolean, pinned?: boolean }>({
  id: 'tab/open',
  group: 'tab',
  title: k18('commands.tab.commands.openTab'),
  async run(args) {
    const state = getState();
    const dispatch = getAppDispatch();

    const docId = args.docId;
    const doc = DocUtils.getDocById(docId);
    if (!doc) {
      Logger.error('Document not found for docId:', docId);
      return;
    }

    // 如果文档已被打开，是否强制打开到新标签页
    const forceNewTab = args.forceNewTab ?? false;
    const switchFocus = args.switchFocus;
    const pinned = args.pinned ?? false;

    // 如果不强制新建Tab，那么先尝试切换到已打开的Tab
    if (!forceNewTab) {
      for (const tab of state.tab.tabs) {
        if (tab.docId === docId) { // 如果有多个的话，会切换到第一个
          dispatch(tabActions.switchTab({ tabId: tab.id, switchFocus }));
          dispatchCommand('tree/node/syncToActiveTab', {});
          return;
        }
      }
    }

    // 创建新Tab来打开文档(包含Library目录文档)
    const id = TabUtils.uniqueTabId();
    const title = doc.title;
    const ignoreDirty = (doc.origin === 'library' && doc.docId.endsWith('/')); // 目录文档忽略脏状态
    const newTab = TabUtils.createTab({ id, title, docId, pinned, ignoreDirty });

    dispatch(tabActions.openTab({ tab: newTab, switchTo: args.switchTo, switchFocus: args.switchFocus }));
    dispatchCommand('tree/node/syncToActiveTab', {});

    // Open conversation for docs that have a conversationId
    if (doc.conversationId && doc.agentId) {
      window.xgw.openConversation(doc.conversationId, doc.agentId).catch(() => {});
    }
  }
});

// 保存指定文档相关联的 Tab 所在的文档
// tabId: string 指定是哪个 Tab 触发的保存操作，没填写则 默认为 ActiveTab
// confirm: boolean 是否需要用户确认才能保存，默认为 无需确认（除非没 filePath）
// closing: boolean 是否保存后关闭 Tab，默认为 false
defineCommand<{ tabId?: string, confirm?: boolean, closing?: boolean }>({
  id: 'tab/save',
  group: 'tab',
  title: k18('commands.tab.commands.saveTab'),
  shortcut: 'Mod+S',
  async run(args) {
    const state = getState();
    const tabId = args.tabId || state.tab.activeTabId;
    if (!tabId) {
      Logger.warn('No active tab found to save document');
      return;
    }
    const tab = state.tab.tabs.find(t => t.id === tabId);
    if (!tab) {
      Logger.warn('Tab not found for tabId:', tabId);
      return;
    }

    // 如果 Tab 设置为忽略脏状态，则不进行保存 (这样设计可以么?)
    if (tab.ignoreDirty) {
      Logger.debug('Tab is set to ignore dirty state, skipping save for tab:', tabId);
      return;
    }

    const confirm = args.confirm ?? false;  // 默认为 false
    const closing = args.closing ?? false;  // 默认为 false

    // 如果不需要确认，直接保存 （没有 filePath 时还是会弹出保存对话框）
    if (!confirm) {
      const docId = tab.docId;
      await dispatchCommand('document/save', { docId, closing, tabId: tab.id } );
      return;
    }

    // 需要确认才能保存
    const doc = DocUtils.getDocById(tab.docId)!;
    Assert.notNull(doc, 'Document not found for tab while confirming save');

    const result = await dialog.confirm({
      title: 'Save Document',
      message: `Do you want to save changes to "${doc.title}"?`,
      buttons: [{ label: 'Save', value: 'Save' }, { label: "Don't Save", value: "Don't Save" }, { label: 'Cancel', value: 'Cancel', isPrimary: true }],
    });

    switch (result) {
      case 'Cancel':      // 用户选择了取消，那么中止tab保存进程（以及可能的Tab关闭过程）
        Logger.debug('User cancelled save for tab:', tabId);
        break;
      case "Don't Save":  // 用户选择了不保存，那么如果是关闭Tab的话就关闭Tab，否则什么也不做
        Logger.debug('User chose not to save for tab:', tabId);
          if (closing) {
            const dispatch = getAppDispatch();
            const docToClose = DocUtils.getDocById(tab.docId);
            if (docToClose?.conversationId) {
              window.xgw.closeConversation(docToClose.conversationId).catch(() => {});
            }
            dispatch(tabActions.closeTab({ tabId: tab.id, ignorePinned: true }));
          }
          break;
        case 'Save':      // 用户选择了保存，那么执行保存操作
          await dispatchCommand('document/save', { docId: tab.docId, closing, tabId: tab.id } );
          break;
    }
  }
});

defineCommand<{ tabId?: string }>({
  id: 'tab/refresh',
  group: 'tab',
  title: k18('commands.tab.commands.refreshTab'),
  run(args) {
    const tabId = args.tabId || getState().tab.activeTabId;
    if (!tabId) {
      Logger.warn('No active tab found to refresh');
      return;
    }

    const dispatch = getAppDispatch();
    dispatch(tabActions.refreshTab({ tabId }));
  }
});

// 关闭指定 Tab，未指定则关闭 ActiveTab
// dirtyAction: 'discard' | 'save' | 'confirm' 指定当Tab为脏时的处理方式, 默认为 'confirm'
// ignorePinned: boolean 指定是否忽略 pinned 状态，默认为 false
defineCommand<{ tabId?: string, dirtyAction?: 'discard' | 'save' | 'confirm', ignorePinned?: boolean }>({
  id: 'tab/close',
  group: 'tab',
  title: k18('commands.tab.commands.closeTab'),
  shortcut: ['Mod+F4', 'Mod+W'],
  run(args) {
    const state = getState();

    let tabId: string | undefined = args.tabId;
    if (!tabId)
      tabId = state.tab.activeTabId;

    const tab = state.tab.tabs.find(t => t.id === tabId);
    if (!tab) {
      Logger.warn('No tab found to close');
      return;
    }

    // 处理 pinned 状态，默认不允许关闭，除非指定 ignorePinned 为 true
    // 此时不能关闭当前Tab，我们把焦点切换到下一个未 pinned 的 Tab 上
    const ignorePinned = args.ignorePinned ?? false;
    if (tab.pinned && !ignorePinned) {
      Logger.debug('Tab is pinned, cannot be closed:', tabId);
      const dispatch = getAppDispatch();
      dispatch(tabActions.switchToNextUnpinnedTab({ currentTabId: tabId }));
      dispatchCommand('tree/node/syncToActiveTab', {});
      return;
    }

    // 不dirty，或者 dirty 但指明要 discard，直接关闭
    const dirtyAction = args.dirtyAction || 'confirm';
    if (!tab._dirty || dirtyAction === 'discard') {
      const dispatch = getAppDispatch();
      const docToClose = DocUtils.getDocById(tab.docId);
      if (docToClose?.conversationId) {
        window.xgw.closeConversation(docToClose.conversationId).catch(() => {});
      }
      dispatch(tabActions.closeTab({ tabId: tabId!, ignorePinned: true }));
      dispatchCommand('tree/node/syncToActiveTab', {});
      return;
    }

    // dirty，要保存，确认或不确认, 关闭将在 保存后进行（或被取消)
    const confirm = (dirtyAction === 'confirm');
    dispatchCommand('tab/save', { tabId: tab.id, confirm, closing: true });
  }
});

defineCommand<{ tabId: string }>({
  id: 'tab/closeOthers',
  group: 'tab',
  title: k18('commands.tab.commands.closeOthers'),
  run(args) {
    const dispatch = getAppDispatch();
    dispatch(tabActions.closeTabs({ excludedTabIds: [args.tabId], ignorePinned: false }));
    dispatchCommand('tree/node/syncToActiveTab', {});
  }
});

defineCommand<{void}>({
  id: 'tab/closeAll',
  group: 'tab',
  title: k18('commands.tab.commands.closeAll'),
  run(args) {
    const dispatch = getAppDispatch();
    dispatch(tabActions.closeTabs({ ignorePinned: true }));
    dispatchCommand('tree/node/syncToActiveTab', {});
  }
});

defineCommand<{ tabId: string, status: boolean }>({
  id: 'tab/pin',
  group: 'tab',
  title: k18('commands.tab.commands.pinTab'),
  run(args) {
    const dispatch = getAppDispatch();
    dispatch(tabActions.pinTab({ tabId: args.tabId, pinned: args.status }) );
  }
});

defineCommand<{ tabId: string, autoScroll: boolean }>({
  id: 'tab/scroll/auto',
  group: 'tab',
  title: k18('commands.tab.commands.autoScroll'),
  run(args) {
    const dispatch = getAppDispatch();
    dispatch(tabActions.setTabAutoScroll({ tabId: args.tabId, autoScroll: args.autoScroll }) );
  }
});

defineCommand<{ tabId: string, switchFocus: boolean }>({
  id: 'tab/switch',
  group: 'tab',
  title: k18('commands.tab.commands.switchTab'),
  run(args) {
    const { tabId, switchFocus } = args;
    const dispatch = getAppDispatch();
    dispatch(tabActions.switchTab({ tabId, switchFocus }) );
    dispatchCommand('tree/node/syncToActiveTab', {});
  }
});

function switchToPrevTab(order: 'recent' | 'position') {
  const state = getState();
  const dispatch = getAppDispatch();

  const tabs = state.tab.tabs;
  const activeTabId = state.tab.activeTabId;
  const recentTabIds = state.tab.recentTabIds;

  if (tabs.length < 1)
    return
  Logger.debug('tab', `Switching to next tab by: ${order}`);

  if (order === 'recent') {
    dispatch(tabActions.switchTab({ tabId: recentTabIds[recentTabIds.length - 1], switchFocus: true }));
  } else { // 'position' // 按照位置顺序切换
    const currentIndex = tabs.findIndex(t => t.id === activeTabId)
    const nextIndex = currentIndex == 0 ? tabs.length - 1 : currentIndex - 1;
    dispatch(tabActions.switchTab({ tabId: tabs[nextIndex].id, switchFocus: true }));
  }
}

function switchToNextTab(order: 'recent' | 'position') {
  const state = getState();
  const dispatch = getAppDispatch();

  const tabs = state.tab.tabs;
  const activeTabId = state.tab.activeTabId;
  const recentTabIds = state.tab.recentTabIds;

  if (tabs.length < 1)
    return
  Logger.debug('tab', `Switching to next tab by: ${order}`);

  if (order === 'recent') {
    dispatch(tabActions.switchTab({ tabId: recentTabIds[1], switchFocus: true }));
  } else { // 'position' // 按照位置顺序切换
    const currentIndex = tabs.findIndex(t => t.id === activeTabId);
    const nextIndex = currentIndex == tabs.length - 1 ? 0 : currentIndex + 1;
    dispatch(tabActions.switchTab({ tabId: tabs[nextIndex].id, switchFocus: true }));
  }
}

defineCommand<{ void }>({
  id: 'tab/next/recent',
  group: 'tab',
  title: k18('commands.tab.commands.nextRecent'),
  shortcut: 'Mod+Tab',
  run(args) {
    switchToNextTab('recent');
    dispatchCommand('tree/node/syncToActiveTab', {});
  }
});

defineCommand<{ void }>({
  id: 'tab/prev/recent',
  group: 'tab',
  title: k18('commands.tab.commands.prevRecent'),
  shortcut: 'Mod+Shift+Tab',
  run(args) {
    switchToPrevTab('recent');
    dispatchCommand('tree/node/syncToActiveTab', {});
  }
});

defineCommand<{ void }>({
  id: 'tab/next/position',
  group: 'tab',
  title: k18('commands.tab.commands.nextPosition'),
  shortcut: OS === 'macos' ? 'Ctrl+Tab' : 'Mod+PageDown',
  run(args) {
    switchToNextTab('position');
    dispatchCommand('tree/node/syncToActiveTab', {});
  }
});

defineCommand<{ void }>({
  id: 'tab/prev/position',
  group: 'tab',
  title: k18('commands.tab.commands.prevPosition'),
  shortcut: OS === 'macos' ? 'Ctrl+Shift+Tab' : 'Mod+PageUp',
  run(args) {
    switchToPrevTab('position');
    dispatchCommand('tree/node/syncToActiveTab', {});
  }
});

// 注：此命令中的TabStatus只能为 'outdated' 或 'deleted'
defineCommand<{ docId: string, status: TabStatus }>({
  id: 'tab/status/update',
  group: 'tab',
  title: k18('commands.tab.commands.updateStatus'),
  run({ docId, status }) {
    const state = getState();

    const affectedTabs = state.tab.tabs.filter(tab => tab.docId === docId);
    if (affectedTabs.length === 0) {
      Logger.warn('No tabs found for docId:', docId);
      return;
    }

    const dispatch = getAppDispatch();
    for (const tab of affectedTabs) {
      Logger.debug(`Updating status of tab ${tab.id} (docId: ${docId}) to ${status}`);
      dispatch(tabActions.updateTabStatus({ tabId: tab.id, status }));
    }
  }
});

// 打开一个新的Tab，显示指定的内容，用于调试或导出等场景
defineCommand<{ content: string, title?: string }>({
  id: 'tab/dump',
  title: k18('commands.tab.commands.dumpContent'),
  description: k18('commands.tab.commands.dumpContentDesc'),
  icon: 'TreePine',
  run({ content, title }) {
    // 先准备好在(下一个即将打开的)新的编辑器Tab中显示内容
    theAppEventBus.once('editor:created', ({ docId, tabId }) => {
      const view = theDocManager.getEditorView(tabId);
      if (!view) {
        Logger.error('tab/dump', `Failed to find editor view for tabId: ${tabId}`);
        return;
      }
      DocAppender.append(view, content);
    });

    // 打开一个新的编辑器Tab来显示指定内容
    dispatchCommand('tab/new', { title, switchTo: true, switchFocus: true, ignoreDirty: true });
  },
});

// 处理编辑器中 @kb/... 链接点击，解析为对应的 LibraryDoc 并打开 Tab
// link 格式: @kb/{libName}/{relPath}  (由 refLinkClickHandler 传入)
defineCommand<{ link: string }>({
  id: 'tab/open/eidux-link',
  group: 'tab',
  title: k18('commands.tab.commands.openEiduxLink'),
  async run({ link }) {
    // 去掉开头的 @
    const withoutAt = link.startsWith('@') ? link.slice(1) : link;

    // 格式: kb/{libName}/{relPath}
    if (!withoutAt.startsWith('kb/')) {
      Logger.warn('tab/open/eidux-link', `Unsupported link format: ${link}`);
      return;
    }

    const parts = withoutAt.slice('kb/'.length).split('/');
    const libName = parts[0];
    const relPath = parts.slice(1).join('/');

    if (!libName) {
      Logger.warn('tab/open/eidux-link', `Missing lib name in link: ${link}`);
      return;
    }

    const state = getState();
    const libs = state.lib.libs;

    // 找到名称匹配的 library
    const lib = Object.values(libs).find(l => l.meta?.name === libName);
    if (!lib || !lib.libPath) {
      Logger.warn('tab/open/eidux-link', `Library not found: ${libName}`);
      return;
    }

    const { path } = await import('@lib/path.js');
    const docPath = path.toPosixPath(path.join(lib.libPath, relPath));
    const doc = DocUtils.createLibraryDoc(docPath, lib);
    const docId = DocUtils.docId(doc);

    const dispatch = getAppDispatch();
    // 如果 doc 不在 state 中，先加入
    if (!DocUtils.getDocById(docId)) {
      dispatch(docActions.addDoc({ doc }));
    }

    await dispatchCommand('tab/open', { docId, switchTo: true, switchFocus: true });
  }
});
